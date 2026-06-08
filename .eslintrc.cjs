module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  env: {
    node: true,
    es2020: true,
  },
  extends: [
    'eslint:recommended',
  ],
  plugins: [],
  ignorePatterns: ['src/web/static/'],
  rules: {
    // 内置规则
    'no-unused-vars': 'warn',
    'no-console': 'off',
    // 自定义规则（通过 --rulesdir 加载）
    'no-raw-env': 'error',
    'naming-convention': 'warn',
    'no-service-import-web': 'error',
  },
  overrides: [
    {
      files: ['test/**/*.ts'],
      rules: {
        'no-raw-env': 'off', // 测试允许直接设置 process.env.DATA_DIR
      },
    },
    {
      files: ['src/index.ts'],
      rules: {
        'no-raw-env': 'off', // 入口文件允许直接读取 DATA_DIR
      },
    },
  ],
};
