<h1 align="center">Vite Vue3 H5 Template</h1>

**🌱 基于 Vue3 全家桶、TS/JS、Vite 构建工具，开箱即用的移动端项目基础模板**

- [x] ⚡ Vue3 + Vite5
- [x] 🍕 TypeScript
- [x] ✨ Vant4 组件库
- [x] 🌀 Tailwindcss 原子类框架
- [x] 👏 集成多种图标方案
- [x] 🍍 Pinia 状态管理
- [x] 🌓 支持深色模式
- [x] 🧀 支持 i18n
- [x] Vue-router 4
- [x] vmin 视口适配
- [x] Axios 封装
- [x] 打包资源 gzip 压缩
- [x] 开发环境支持 Mock 数据
- [x] ESLint
- [x] 首屏加载动画

## 运行项目

注意：要求 Node 版本 16+，可使用 [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) 进行本地 Node 版本管理，同时建议使用 [pnpm](https://pnpm.io/zh/installation) 包管理器。

```shell

# 安装 pnpm
npm i -g pnpm@latest-8

# 安装依赖
pnpm install

# 启动服务
pnpm dev

# git 初始化
git init

# 初始化 husky
pnpm prepare
```

```bash
# 查看源
pnpm get registry
# 切换淘宝源
pnpm config set registry http://registry.npmmirror.com
#切换默认源
pnpm config set registry https://registry.npmjs.org
```

服务启动成功后，浏览器访问 [http://localhost:9527](http://localhost:9527)

## 规范

#### 1. Git 提交规范

`由于用了commitlint插件，git commit信息里的类型是必须要写的，并且要带英文冒号和空一格，不然提交会报错。`

```bash
feat: 新功能
fix: 修复 bug
add: 增加内容
del: 删除功能
update: 更新功能
docs: 文档更新
style: 颜色、字体大小等变动（不影响代码运行）
build: 构造工具或相关依赖变更
refactor: 代码重构
revert: 撤销，版本回退
test: 添加或修改测试
perf: 提高性能的改动
chore: 构建过程或辅助工具的变更
ci: CI 配置，脚本文件等改动
```

```bash
# <type>后面必须加英文冒号，并且后跟一个空格
git commit -m <type>(<scope>): <description>

# 举个栗子
git commit -m 'fix: 修复了登录缓存问题'
git commit -m 'fix(user): 修复了用户模块token传参问题'
git commit -m 'docs: 更新了自定义组件文档'
```

#### 2. 使用 Husky+Lint-Staged+Commitlint 规范提交

`Husky` 是 git 提交的 hooks 钩子工具。  
`Lint-Staged` 插件会监测暂存区的代码，通过了则允许提交。  
`Commitlint` 用来监测 git 提交的信息规范。

#### 3. tag版本使用并生成changelog

```bash
#<version>需要使用语义化版本[https://semver.org/lang/zh-CN/](https://semver.org/lang/zh-CN/)
pnpm release --release-as <version>
# 举个栗子
pnpm release --release-as 0.0.1+0426
```

### <span id="router">路由缓存 & 命名注意 ⚠</span>

组件默认不开启缓存，如某个组件需开启缓存，在对应路由 `meta` 内的 `noCache` 字段赋值为 `false` 即可。

```typescript
// src/router/routes.ts
const routes: Array<RouteRecordRaw> = [
  // ...
  {
    path: 'about',
    name: 'About',
    component: () => import('@/views/about/index.vue'),
    meta: {
      title: '关于',
      noCache: false,
    },
  },
];
```

为了保证页面能被正确缓存，请确保**组件**的 `name` 值和对应路由的 `name` 命名完全相同。

```vue
<!-- src/views/about/index.vue -->
<script setup lang="ts">
  // Vue3.3+ defineOptions 宏
  defineOptions({
    name: 'About',
  });
</script>

<template>
  <div>about</div>
</template>
```
