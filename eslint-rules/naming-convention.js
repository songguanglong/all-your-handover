const path = require('path');

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: '文件名后缀必须符合约定（-service/-api/-provider/-adapter/-client/-middleware）',
      category: 'Stylistic Issues',
    },
    schema: [],
    messages: {
      namingMismatch: '文件 "{{basename}}" 含 HTTP 路由逻辑但使用 -service 后缀，应使用 -api 或 -middleware',
    },
  },
  create(context) {
    const filename = context.getFilename();
    const basename = path.basename(filename, '.ts');
    const content = context.getSourceCode().getText();

    // 只检查 src/web/ 下的文件
    if (!filename.includes('src/web/')) return {};

    // 如果文件含 router. 调用且后缀是 -service，报 warning
    if (basename.endsWith('-service') && content.includes('router.')) {
      context.report({
        node: context.getSourceCode().ast,
        messageId: 'namingMismatch',
        data: { basename },
      });
    }

    return {};
  },
};
