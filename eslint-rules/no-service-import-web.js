module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'services/ 目录文件禁止 import web/ 目录文件（单向依赖约束）',
      category: 'Architecture',
    },
    schema: [],
    messages: {
      noServiceImportWeb: 'services/ 禁止 import web/："{{importPath}}"（应通过 callback 注册通信）',
    },
  },
  create(context) {
    const filename = context.getFilename();

    // 只检查 src/services/ 下的文件
    if (!filename.includes('src/services/')) return {};

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;
        // 检测相对路径引用 web/
        if (importPath.startsWith('../web/') || importPath.startsWith('./web/')) {
          context.report({
            node,
            messageId: 'noServiceImportWeb',
            data: { importPath },
          });
        }
      },
    };
  },
};
