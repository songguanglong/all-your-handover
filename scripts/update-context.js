#!/usr/bin/env node
/**
 * CONTEXT.json 生成脚本
 * 从 src/ 目录解析 TypeScript AST，提取路由端点、类型定义、模块依赖
 */

const fs = require('fs');
const path = require('path');

// 简单正则提取，不依赖 TypeScript compiler API（避免配置复杂性）
function generateContext() {
  const srcDir = path.join(__dirname, '..', 'src');
  const files = walkDir(srcDir).filter(f => f.endsWith('.ts'));

  const endpoints = {
    web: [],
    admin: [],
    webhook: [],
    auth: []
  };

  const types = {};
  const modules = {};
  const violations = [];

  files.forEach(file => {
    const relPath = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    // 模块分类
    const moduleName = getModuleName(relPath);
    if (!modules[moduleName]) {
      modules[moduleName] = { files: [], exports: [], consumers: [] };
    }
    modules[moduleName].files.push(relPath);

    // 提取 exported functions/classes/interfaces
    lines.forEach((line, idx) => {
      const exportMatch = line.match(/^export\s+(?:function|class|interface|type)\s+(\w+)/);
      if (exportMatch) {
        modules[moduleName].exports.push(exportMatch[1]);
      }

      // 提取 router endpoints
      const routerMatch = line.match(/router\.(get|post|put|delete)\(`\$\{prefix\}\/(.+?)`/);
      if (routerMatch) {
        const method = routerMatch[1].toUpperCase();
        const routePath = routerMatch[2];
        const auth = detectAuth(lines, idx);

        let category = 'web';
        if (relPath.includes('admin')) category = 'admin';
        if (relPath.includes('webhook')) category = 'webhook';
        if (relPath.includes('h5-auth')) category = 'auth';

        endpoints[category].push({
          method,
          path: routePath,
          file: relPath,
          line: idx + 1,
          auth
        });
      }

      // 提取 webhook endpoints (app.post('/webhook/...'))
      const webhookMatch = line.match(/app\.(post|get|put|delete)\(['"]\/webhook\/(.+?)['"]/);
      if (webhookMatch) {
        endpoints.webhook.push({
          method: webhookMatch[1].toUpperCase(),
          path: 'webhook/' + webhookMatch[2],
          file: relPath,
          line: idx + 1,
          auth: 'none'
        });
      }

      // 提取 export interface
      const interfaceMatch = line.match(/^export\s+interface\s+(\w+)/);
      if (interfaceMatch) {
        const interfaceName = interfaceMatch[1];
        const fields = extractInterfaceFields(lines, idx);
        types[interfaceName] = {
          file: relPath,
          line: idx + 1,
          fields
        };
      }

      // 检查 no-raw-env 违规
      if (relPath !== 'src/index.ts' && relPath !== 'src/utils/data-dir.ts') {
        if (line.match(/process\.env\.DATA_DIR/)) {
          violations.push({
            rule: 'no-raw-env',
            file: relPath,
            line: idx + 1,
            severity: 'error',
            message: 'Direct process.env.DATA_DIR usage. Use getDataDir() instead.'
          });
        }
      }

      // 检查命名约定违规
      const basename = path.basename(relPath, '.ts');
      if (relPath.startsWith('src/web/') && relPath.includes('-service') && !relPath.includes('-api') && !relPath.includes('-middleware')) {
        const hasRouter = content.includes('router.');
        if (hasRouter) {
          violations.push({
            rule: 'naming-convention',
            file: relPath,
            line: 1,
            severity: 'warn',
            message: `File ${basename} contains router logic but uses -service suffix. Consider -api or -middleware.`
          });
        }
      }
    });
  });

  // 构建依赖图
  files.forEach(file => {
    const relPath = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf-8');
    const moduleName = getModuleName(relPath);

    const importMatches = content.matchAll(/from\s+['"](.+?)['"];?/g);
    for (const match of importMatches) {
      const importPath = match[1];
      if (importPath.startsWith('.')) {
        const targetModule = getModuleName(importPath);
        if (targetModule && targetModule !== moduleName) {
          // 记录反向依赖（services/ import web/）
          if (moduleName === 'services' && targetModule === 'web') {
            violations.push({
              rule: 'no-service-import-web',
              file: relPath,
              line: content.substring(0, match.index).split('\n').length,
              severity: 'error',
              message: `Service layer file imports web layer: ${importPath}`
            });
          }
          // 记录消费者
          if (!modules[targetModule]) {
            modules[targetModule] = { files: [], exports: [], consumers: [] };
          }
          if (!modules[targetModule].consumers.includes(relPath)) {
            modules[targetModule].consumers.push(relPath);
          }
        }
      }
    }
  });

  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

  const context = {
    meta: {
      version: packageJson.version,
      techStack: ['typescript', 'node', 'express', 'vitest'],
      entryFiles: ['src/index.ts', 'dist/index.js'],
      scripts: packageJson.scripts,
      generatedAt: new Date().toISOString(),
      sourceHash: computeHash(files)
    },
    endpoints,
    types,
    modules,
    conventions: {
      violations,
      coverage: {
        'no-raw-env': `${files.filter(f => {
          const content = fs.readFileSync(f, 'utf-8');
          return !content.includes('process.env.DATA_DIR') || f.endsWith('index.ts') || f.endsWith('data-dir.ts');
        }).length}/${files.length}`,
        'naming-convention': 'pending-renaming'
      }
    },
    wiring: {
      autoCommitCallbacks: [
        { service: 'record-service', register: 'setAutoCommit', consumer: 'app' },
        { service: 'draft-raw-service', register: 'setAutoCommit', consumer: 'app' },
        { service: 'draft-analysis-service', register: 'setAutoCommit', consumer: 'app' },
        { service: 'draft-preview-service', register: 'setAutoCommit', consumer: 'app' },
        { service: 'handover-service', register: 'setAutoCommit', consumer: 'app' },
        { service: 'channel-memory-service', register: 'setAutoCommit', consumer: 'app' },
        { service: 'experience-service', register: 'setAutoCommit', consumer: 'app' }
      ],
      eventBus: [
        { source: 'h5-api.ts', event: 'notifyDraftUpdate', listeners: ['draft-events.ts'] }
      ]
    }
  };

  return context;
}

function walkDir(dir, results = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && item !== 'node_modules' && item !== '.git') {
      walkDir(fullPath, results);
    } else if (stat.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function getModuleName(relPath) {
  if (relPath.startsWith('src/services/')) return 'services';
  if (relPath.startsWith('src/web/')) return 'web';
  if (relPath.startsWith('src/channels/')) return 'channels';
  if (relPath.startsWith('src/llm/')) return 'llm';
  if (relPath.startsWith('src/utils/')) return 'utils';
  if (relPath.startsWith('src/types/')) return 'types';
  return 'root';
}

function detectAuth(lines, routerLine) {
  // 向上查找 3 行，看是否有 h5RequireAuth 或 adminAuthMiddleware
  for (let i = Math.max(0, routerLine - 3); i < routerLine; i++) {
    if (lines[i].includes('h5RequireAuth')) return 'required';
    if (lines[i].includes('adminAuthMiddleware')) return 'admin';
    if (lines[i].includes('h5OptionalAuth')) return 'optional';
  }
  return 'none';
}

function extractInterfaceFields(lines, startLine) {
  const fields = [];
  let braceDepth = 0;
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('{')) braceDepth++;
    if (line.includes('}')) {
      braceDepth--;
      if (braceDepth === 0) break;
    }
    const fieldMatch = line.match(/(\w+)(\??:)\s+([^;]+);/);
    if (fieldMatch && braceDepth > 0) {
      fields.push(fieldMatch[1]);
    }
  }
  return fields;
}

function computeHash(files) {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256');
  files.forEach(f => hash.update(fs.readFileSync(f)));
  return hash.digest('hex').substring(0, 16);
}

// 主函数
const context = generateContext();
const outputPath = path.join(__dirname, '..', 'CONTEXT.json');
fs.writeFileSync(outputPath, JSON.stringify(context, null, 2));
console.log(`CONTEXT.json generated at ${outputPath}`);
console.log(`  Endpoints: web=${context.endpoints.web.length}, admin=${context.endpoints.admin.length}, webhook=${context.endpoints.webhook.length}`);
console.log(`  Types: ${Object.keys(context.types).length}`);
console.log(`  Violations: ${context.conventions.violations.length}`);
