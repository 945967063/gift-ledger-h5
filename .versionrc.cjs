module.exports = {
  types: [
    {
      type: 'feat',
      section: '增加新功能',
      hidden: false,
    },
    {
      type: 'fix',
      section: '修复 bug',
      hidden: false,
    },
    {
      type: 'add',
      section: '增加代码逻辑',
      hidden: false,
    },
    {
      type: 'del',
      section: '删除功能',
      hidden: false,
    },
    {
      type: 'update',
      section: '更新功能',
      hidden: false,
    },
    {
      type: 'docs',
      section: '文档相关的改动',
      hidden: false,
    },
    {
      type: 'style',
      section: '不影响代码逻辑的改动，例如修改空格，缩进等',
      hidden: false,
    },
    {
      type: 'build',
      section: '构造工具或者相关依赖的改动',
      hidden: false,
    },
    {
      type: 'refactor',
      section: '代码重构',
      hidden: false,
    },
    {
      type: 'revert',
      section: '撤销，版本回退',
      hidden: false,
    },
    {
      type: 'test',
      section: '添加或修改测试',
      hidden: false,
    },
    {
      type: 'perf',
      section: '提高性能的改动',
      hidden: false,
    },
    {
      type: 'chore',
      section: '构建过程或辅助工具的变动',
      hidden: false,
    },
    {
      type: 'ci',
      section: 'CI 配置，脚本文件等改动',
      hidden: false,
    },
  ],
  skip: {
    bump: false, // 是否跳过版本号递增
    changelog: false, // 是否跳过更新变更日志
    commit: false, // 是否跳过提交 commit
    tag: false, // 是否跳过打 tag
  },
  debug: false, // 是否开启调试模式
  dryRun: false, // 是否启用试运行模式（不会真正修改文件）
  packageFiles: [{ filename: 'package.json', type: 'json' }], // 需要更新的 package 文件
  bumpFiles: [
    { filename: 'package.json', type: 'json' }, // 版本号递增的文件
  ],
};
