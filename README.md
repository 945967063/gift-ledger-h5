# 人情簿 Gift Ledger

人情簿是一个移动端人情往来记录应用，支持收礼、送礼、联系人对账、事件管理和年度统计。业务数据存储在后端 SQLite 数据库中，各账号严格隔离。

## 主要功能

- 手机号注册、登录和 JWT 身份验证
- 记录收礼与送礼，支持现金、微信、支付宝和自定义方式，默认现金
- 自动建立联系人并统计双向往来差额
- 按事件、年份、联系人和人情类型查看数据
- 响应式 H5 界面，支持浅色和深色主题
- 前端单元测试、后端 API 集成测试和生产构建校验

## 技术架构

- 前端：Vue 3、TypeScript、Vite、Vant、Pinia
- 后端：Node.js、Express、TypeScript
- 数据库：SQLite（WAL 模式）
- 部署：Docker Compose、Nginx

## 本地开发

### 环境要求

- Node.js 24 LTS（最低支持 Node.js 22）
- pnpm 8.6.3
- npm（用于安装后端依赖）

```bash
nvm use
corepack enable
corepack prepare pnpm@8.6.3 --activate
pnpm install --frozen-lockfile
npm --prefix server ci
```

配置本地后端：

```bash
cp server/.env.example server/.env
```

分别启动后端和前端：

```bash
npm --prefix server run dev
pnpm dev
```

默认地址：

- 前端：`http://localhost:9527`
- API：`http://localhost:3000/api`
- 健康检查：`http://localhost:3000/api/health`

项目不再自动注入演示业务数据。首次使用请在登录页注册账号。

## 质量校验

```bash
# 前端 Vitest
pnpm test:frontend

# 后端 Node.js API 集成测试
pnpm test:backend

# ESLint + 全部测试 + 生产构建
pnpm check
```

后端测试使用独立临时数据库，不会修改本地业务数据。

## Docker 生产部署

1. 创建环境变量文件并生成随机密钥：

```bash
cp .env.example .env
openssl rand -hex 32
```

将输出的随机值填入 `.env` 的 `JWT_SECRET`。同源部署时 `CORS_ORIGIN` 保持为空；前后端分离时，必须填写完整且可信的 HTTPS 来源。

2. 构建并启动：

```bash
docker compose build
docker compose up -d
docker compose ps
```

如果 Docker Desktop 29.x 在包含中文字符的项目路径下报出 gRPC `non-printable ASCII` 错误，请将项目复制到纯英文路径后再执行上述命令。这是 Docker Desktop 读取 Compose 工作目录时的环境兼容问题，不影响镜像内容。

3. 验证服务：

```bash
curl --fail http://localhost:${HOST_PORT:-80}/api/health
```

Docker 部署使用 Nginx 同源代理 `/api`，SQLite 数据持久化到 `gift_ledger_sqlite_data` Volume。后端容器以非 root 用户运行，且生产启动时会拒绝空值或过短的 JWT 密钥。

### HTTPS

容器默认只监听 HTTP。公网部署必须在宿主机反向代理、负载均衡器或云平台上终止 TLS，并强制 HTTPS。不要将后端 3000 端口直接暴露到公网。

### 备份与恢复

SQLite 只适合单后端实例；不要让多个容器同时写入同一个数据文件。备份前先停止后端，以便同时保存数据库和 WAL 状态：

```bash
mkdir -p backups
docker compose stop backend
docker run --rm \
  -v gift_ledger_sqlite_data:/data:ro \
  -v "$PWD/backups":/backup \
  alpine sh -c 'tar czf /backup/gift-ledger-$(date +%Y%m%d-%H%M%S).tgz -C /data .'
docker compose start backend
```

恢复时应停止后端、额外保留当前 Volume 快照，然后将备份内容完整恢复到 Volume。

## 环境变量

| 变量                | 用途                               | 默认值                         |
| ------------------- | ---------------------------------- | ------------------------------ |
| `JWT_SECRET`        | JWT 签名密钥，生产必填且至少 32 位 | 无                             |
| `HOST_PORT`         | Docker 前端对外端口                | `80`                           |
| `CORS_ORIGIN`       | 允许的跨域来源，可逗号分隔         | 空（仅同源）                   |
| `AUTH_RATE_LIMIT`   | 单 IP 每 15 分钟认证请求上限       | `100`                          |
| `PORT`              | 后端监听端口                       | `3000`                         |
| `DB_DIR`            | SQLite 数据目录                    | 本地 `data/`，容器 `/app/data` |
| `VITE_API_BASE_URL` | 前端构建时 API 基地址              | `/api`                         |

## 发布前清单

- `pnpm check` 全部通过
- `docker compose build` 成功
- 生产 `JWT_SECRET` 为独立随机值，未写入 Git
- 已配置 HTTPS、数据备份和容器日志保留策略
- 已用正式域名验证注册、登录、新增、刷新持久化、退出登录和账号隔离
