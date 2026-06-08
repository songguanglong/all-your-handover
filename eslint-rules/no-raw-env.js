module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止直接访问 process.env.DATA_DIR，必须使用 getDataDir()',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noRawEnv: '禁止直接访问 process.env.DATA_DIR。请使用 getDataDir()。例外：src/index.ts 入口文件',
    },
  },
  create(context) {
    const filename = context.getFilename();
    // src/index.ts 和 src/utils/data-dir.ts 是例外
    if (filename.endsWith('src/index.ts') || filename.endsWith('src/utils/data-dir.ts')) {
      return {};
    }

    return {
      MemberExpression(node) {
        if (
          node.object.type === 'MemberExpression' &&
          node.object.object.name === 'process' &&
          node.object.property.name === 'env' &&
          node.property.name === 'DATA_DIR'
        ) {
          context.report({
            node,
            messageId: 'noRawEnv',
          });
        }
      },
    };
  },
};
