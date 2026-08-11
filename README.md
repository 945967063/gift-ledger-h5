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
- 部署：GHCR、Docker Compose、Nginx

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

2. 拉取最新版镜像并启动：

```bash
docker compose pull
docker compose up -d
docker compose ps
```

生产环境默认从 GHCR 拉取 `latest` 镜像，不会在 VPS 上安装前端依赖或编译源码。开发者需要在本地构建镜像时使用：

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

如果 Docker Desktop 29.x 在包含中文字符的项目路径下报出 gRPC `non-printable ASCII` 错误，请将项目复制到纯英文路径后再执行本地构建。这是 Docker Desktop 读取 Compose 工作目录时的环境兼容问题，不影响镜像内容。

3. 验证服务：

```bash
curl --fail http://localhost:${HOST_PORT:-8090}/api/health
```

Docker 部署使用 Nginx 同源代理 `/api`，SQLite 数据持久化到 `gift_ledger_sqlite_data` Volume。后端容器以非 root 用户运行，且生产启动时会拒绝空值或过短的 JWT 密钥。

### Ubuntu VPS 一键部署

以下流程适用于 Ubuntu 22.04/24.04。应用默认仅绑定宿主机 `127.0.0.1:8090`，不占用 80 或 8080，也不会将应用直接暴露到公网。宿主机 Nginx 使用公网 8443 端口终止 TLS，再反向代理到该本地端口。

#### 1. 安装 Docker

已经可以执行 `docker compose version` 时可跳过本步骤。新服务器按照 [Docker 官方 Ubuntu 安装方式](https://docs.docker.com/engine/install/ubuntu/)执行：

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl openssl

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
gift_arch=$(dpkg --print-architecture)
gift_codename=${UBUNTU_CODENAME:-$VERSION_CODENAME}

sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${gift_codename}
Components: stable
Architectures: ${gift_arch}
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt-get update
sudo apt-get install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-compose-plugin

sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
```

#### 2. 首次部署

将下面整段命令复制到 VPS 执行。脚本只下载 Compose 和环境变量模板、生成随机 JWT 密钥、拉取预构建镜像并启动服务，不会克隆或编译源码：

```bash
set -e

sudo mkdir -p /opt/gift-ledger-h5
sudo chown -R "$(id -u):$(id -g)" /opt/gift-ledger-h5

cd /opt/gift-ledger-h5

curl -fsSLo docker-compose.yml \
  https://raw.githubusercontent.com/945967063/gift-ledger-h5/master/docker-compose.yml
curl -fsSLo .env.example \
  https://raw.githubusercontent.com/945967063/gift-ledger-h5/master/.env.example

if [ ! -f .env ]; then
  cp .env.example .env
  gift_jwt_secret=$(openssl rand -hex 32)
  sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${gift_jwt_secret}/" .env
  chmod 600 .env
fi

sudo docker compose pull
sudo docker compose up -d --remove-orphans
sudo docker compose ps

gift_host_port=$(sed -n 's/^HOST_PORT=//p' .env | tail -n 1)
curl --fail --retry 10 --retry-delay 3 \
  "http://127.0.0.1:${gift_host_port:-8090}/api/health"
```

健康检查成功后，再配置宿主机 Nginx 提供公网 HTTPS。`.env` 只会在首次部署时创建，后续更新不会覆盖生产密钥。

`HOST_PORT=8090` 只是宿主机本地反向代理端口，不需要在 Cloudflare 的代理端口支持列表中。Cloudflare 和访客连接的是宿主机 Nginx 的 HTTPS 8443 端口。

#### 3. 后续更新

代码推送到 `master` 后，GitHub Actions 会自动发布新的 `latest` 镜像。在 VPS 执行：

```bash
cd /opt/gift-ledger-h5
curl -fsSLo docker-compose.yml \
  https://raw.githubusercontent.com/945967063/gift-ledger-h5/master/docker-compose.yml
sed -i -E 's/^HOST_PORT=(80|8080|8443)$/HOST_PORT=8090/' .env
sudo docker compose pull
sudo docker compose up -d --remove-orphans
sudo docker image prune -f
```

首次发布后，需要在 GitHub Packages 中将 `gift-ledger-h5-frontend` 和 `gift-ledger-h5-backend` 两个容器包设为 **Public**，VPS 才能免登录拉取。镜像发布流程位于 `.github/workflows/docker-publish.yml`。

常用排查命令：

```bash
sudo docker compose ps
sudo docker compose logs -f --tail=200
gift_host_port=$(sed -n 's/^HOST_PORT=//p' .env | tail -n 1)
curl --fail "http://127.0.0.1:${gift_host_port:-8090}/api/health"
```

重新构建或执行 `docker compose down` 不会删除业务数据，但不要执行 `docker compose down -v`；`-v` 会删除包含 SQLite 数据库的 `gift_ledger_sqlite_data` Volume。

### HTTPS

容器内部在 8090 端口监听 HTTP，并通过 Docker 映射到宿主机 `127.0.0.1:8090`。宿主机 Nginx 可使用以下配置在 Cloudflare 支持的 8443 端口提供 HTTPS：

```nginx
server {
    listen 8443 ssl http2;
    listen [::]:8443 ssl http2;
    server_name gift.example.com;

    ssl_certificate /etc/nginx/ssl/origin.pem;
    ssl_certificate_key /etc/nginx/ssl/origin-key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

将 `server_name` 和证书路径替换为实际值，然后执行 `sudo nginx -t && sudo systemctl reload nginx`。Cloudflare DNS 记录需开启代理，并将 SSL/TLS 模式设为 **Full (strict)**。不要将后端 3000 端口直接暴露到公网。

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
| `HOST_PORT`         | 宿主机本地反向代理端口             | `8090`                         |
| `IMAGE_TAG`         | GHCR 镜像标签                      | `latest`                       |
| `CORS_ORIGIN`       | 允许的跨域来源，可逗号分隔         | 空（仅同源）                   |
| `AUTH_RATE_LIMIT`   | 单 IP 每 15 分钟认证请求上限       | `100`                          |
| `PORT`              | 后端监听端口                       | `3000`                         |
| `DB_DIR`            | SQLite 数据目录                    | 本地 `data/`，容器 `/app/data` |
| `VITE_API_BASE_URL` | 前端构建时 API 基地址              | `/api`                         |

## 发布前清单

- `pnpm check` 全部通过
- GitHub Actions 成功发布前端和后端镜像
- `docker compose -f docker-compose.yml -f docker-compose.build.yml build` 成功
- 生产 `JWT_SECRET` 为独立随机值，未写入 Git
- 已配置 HTTPS、数据备份和容器日志保留策略
- 已用正式域名验证注册、登录、新增、刷新持久化、退出登录和账号隔离
