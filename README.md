# 人情簿 Gift Ledger

人情簿是一个移动端人情往来记录应用，支持收礼、送礼、联系人对账、事件管理和年度统计。业务数据存储在后端 SQLite 数据库中，各账号严格隔离。

## 主要功能

- 手机号注册、登录和 JWT 身份验证
- 记录收礼与送礼，支持现金、微信、支付宝和自定义方式，默认现金
- 已保存事件可以继续添加礼金名单；礼金明细支持修改和删除，并自动重新计算总额与人数
- 事件和联系人均支持新增、修改、删除，所有业务数据变更都会写入操作日志
- 事件详情可查看当前事件日志，“我的事件”右上角可查看全局日志；事件删除后日志仍会保留
- 自动建立联系人并统计双向往来差额
- 按事件、年份、联系人和人情类型查看数据
- 账户设置支持修改昵称和浅色/深色主题
- 响应式 H5 界面使用本地 CSS 渐变、环境光晕和玻璃卡片，不依赖外部背景图片
- 前端单元测试、后端 API 集成测试和生产构建校验

## 技术架构

- 前端：Vue 3、TypeScript、Vite、Vant、Pinia
- 后端：Node.js、Express、TypeScript
- 数据库：SQLite（WAL 模式）
- 部署：GHCR、Docker Compose、Nginx、Certbot、Cloudflare

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

## Docker 镜像

生产环境使用 GitHub Container Registry 中的预构建镜像，VPS 无需克隆源码或现场编译：

```text
ghcr.io/945967063/gift-ledger-h5-frontend:latest
ghcr.io/945967063/gift-ledger-h5-backend:latest
```

推送 `master` 或 `v*` 标签时，[Docker 发布流程](.github/workflows/docker-publish.yml)会自动构建并发布 `linux/amd64`、`linux/arm64` 镜像。`latest` 跟随 `master`，版本标签和 `sha-*` 标签可用于固定版本或回滚。两个 GitHub Packages 必须设为 **Public**，VPS 才能免登录拉取。

开发者需要在本地构建镜像时使用覆盖配置：

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

## VPS 生产部署

当前正式部署地址为 <https://rq.lileyi.de>，完整请求链路如下：

```text
浏览器 → Cloudflare → 宿主机 Nginx/Certbot :443
       → http://127.0.0.1:8090 → 前端容器 :8090
       → Docker 内部网络 → 后端容器 :3000
```

| 端口   | 监听范围        | 用途                                      |
| ------ | --------------- | ----------------------------------------- |
| `80`   | 宿主机 Nginx    | Let's Encrypt 验证及 HTTP 跳转 HTTPS      |
| `443`  | 宿主机 Nginx    | `rq.lileyi.de` 公网 HTTPS                 |
| `8090` | `127.0.0.1`     | 宿主机 Nginx 到前端容器的本地反向代理端口 |
| `3000` | Docker 内部网络 | 前端容器到后端 API，不映射到宿主机        |

Nginx 可以通过 `server_name`/SNI 让 `rq.lileyi.de` 与 `img.lileyi.de` 共用宿主机的 80、443 端口。Docker 只绑定 `127.0.0.1:8090`，不会占用公网 80、443，也不会直接暴露到公网。

### 1. 安装 Docker、Nginx 和 Certbot

已有 `docker compose`、Nginx 和 Certbot 时跳过本节。Docker 请使用[官方 Ubuntu 安装方式](https://docs.docker.com/engine/install/ubuntu/)，Certbot 请参考[官方 Nginx 安装说明](https://certbot.eff.org/instructions?ws=nginx&os=snap)：

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl nginx openssl snapd

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

sudo snap install --classic certbot
sudo ln -sfn /snap/bin/certbot /usr/local/bin/certbot
sudo systemctl enable --now docker nginx

sudo docker version
sudo docker compose version
certbot --version
```

### 2. 首次启动应用

下面的脚本只下载 Compose 与环境变量模板、生成随机 JWT 密钥并拉取预构建镜像。`.env` 只在首次部署时创建，后续更新不会覆盖生产密钥。

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

同源部署时 `CORS_ORIGIN` 保持为空。后端容器会在生产启动时拒绝空值或不足 32 位的 `JWT_SECRET`。

### 3. 配置 Nginx 与申请证书

首次签发 Let's Encrypt 证书前，在 Cloudflare 中确认 `rq.lileyi.de` 指向 VPS。若代理状态导致 ACME 验证被拦截，可暂时切换为“仅 DNS”，证书签发后再恢复橙云。

先创建 `/etc/nginx/sites-available/rq.lileyi.de.conf`：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name rq.lileyi.de;

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
}
```

启用站点并签发证书：

```bash
sudo ln -sfn \
  /etc/nginx/sites-available/rq.lileyi.de.conf \
  /etc/nginx/sites-enabled/rq.lileyi.de.conf

sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d rq.lileyi.de --redirect
sudo nginx -t
sudo systemctl reload nginx
sudo certbot renew --dry-run
```

Certbot 会自动添加 443 监听、HTTP 到 HTTPS 跳转和以下证书路径：

```text
/etc/letsencrypt/live/rq.lileyi.de/fullchain.pem
/etc/letsencrypt/live/rq.lileyi.de/privkey.pem
```

签发后的 HTTPS 核心配置应类似：

```nginx
server {
    server_name rq.lileyi.de;

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    listen 443 ssl;
    listen [::]:443 ssl;
    ssl_certificate /etc/letsencrypt/live/rq.lileyi.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rq.lileyi.de/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}
```

不要复用 `img.lileyi.de` 的证书，除非该证书的 SAN 明确包含 `rq.lileyi.de`。证书文件和 Certbot 管理的配置不要提交到本仓库。

### 4. Cloudflare 设置

- DNS：`rq.lileyi.de` 指向 VPS，证书签发成功后开启橙云代理。
- SSL/TLS 加密模式：**Full (strict)**。
- 公网地址：<https://rq.lileyi.de>，无需附加端口。
- VPS 防火墙和云安全组需要允许 TCP 80、443；不要开放 8090、3000。

### 5. 部署验证

依次验证后端、Docker 前端、宿主机 Nginx 和公网链路：

```bash
cd /opt/gift-ledger-h5

sudo docker compose ps
sudo docker compose exec backend \
  node -e "require('http').get('http://127.0.0.1:3000/api/health', r => { console.log(r.statusCode); process.exit(r.statusCode === 200 ? 0 : 1) })"
curl --fail http://127.0.0.1:8090/api/health
curl --fail https://rq.lileyi.de/api/health
```

最后用浏览器访问 <https://rq.lileyi.de>，依次验证：

1. 注册、登录、修改账户昵称与退出登录。
2. 新建收礼事件并添加至少一位宾客，保存后从“我的事件”继续添加第二位宾客。
3. 修改、删除礼金明细，确认事件总额与人数同步变化。
4. 修改事件和联系人资料，确认关联礼金明细同步更新。
5. 查看事件详情日志以及“我的事件”右上角的全局日志。
6. 删除测试事件后再次打开全局日志，确认删除事件与明细的记录仍然存在。
7. 切换深色模式并刷新页面，确认数据与主题设置均正常保留。

### 6. 后续更新与回滚

推送 `master` 后，等待 GitHub Actions 成功发布新的 `latest` 镜像，再在 VPS 执行：

```bash
cd /opt/gift-ledger-h5

curl -fsSLo docker-compose.yml \
  https://raw.githubusercontent.com/945967063/gift-ledger-h5/master/docker-compose.yml

sudo docker compose pull
sudo docker compose up -d --remove-orphans
sudo docker compose ps
curl --fail https://rq.lileyi.de/api/health
sudo docker image prune -f
```

如需固定或回滚到已发布的版本，将 `.env` 中的 `IMAGE_TAG=latest` 改为对应的 `v*` 或 `sha-*` 标签，然后再次执行 `docker compose pull && docker compose up -d`。

### 7. 日志与排障

```bash
cd /opt/gift-ledger-h5

sudo docker compose ps
sudo docker compose logs -f --tail=200
sudo nginx -t
sudo journalctl -u nginx -n 200 --no-pager
sudo certbot certificates
sudo ss -lntp | grep -E ':(80|443|8090)\b'
```

| 现象                    | 优先检查                                                         |
| ----------------------- | ---------------------------------------------------------------- |
| GHCR `denied`           | 两个 GitHub Packages 是否为 Public，镜像标签是否存在             |
| 本机 `8090` 无响应      | `docker compose ps`、前后端日志、`.env` 中的 `JWT_SECRET`        |
| Nginx `502 Bad Gateway` | `curl http://127.0.0.1:8090/api/health` 是否成功                 |
| Cloudflare `403`        | Nginx `server_name`、Cloudflare WAF/访问规则                     |
| Cloudflare `526`        | Certbot 证书是否过期、域名是否匹配、SSL/TLS 是否为 Full (strict) |
| Certbot 验证失败        | DNS 是否指向本机、TCP 80 是否可达、是否需要暂时关闭橙云          |

### 8. 数据备份与恢复

SQLite 只适合单后端实例，不要让多个后端容器同时写入同一个 Volume。备份前停止后端，以便同时保存数据库和 WAL 状态：

```bash
cd /opt/gift-ledger-h5
mkdir -p backups

sudo docker compose stop backend
sudo docker run --rm \
  -v gift_ledger_sqlite_data:/data:ro \
  -v "$PWD/backups":/backup \
  alpine sh -c 'tar czf /backup/gift-ledger-$(date +%Y%m%d-%H%M%S).tgz -C /data .'
sudo docker compose start backend
```

确认备份文件存在且大小合理，并将其复制到 VPS 之外。恢复前必须停止后端，先为当前 Volume 额外制作快照，再将指定备份完整恢复；不要在运行中的 SQLite 数据库上直接覆盖文件。

执行 `docker compose down`、更新镜像或重新创建容器不会删除业务数据。不要执行 `docker compose down -v`，因为 `-v` 会删除 `gift_ledger_sqlite_data` Volume。

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
- `8090` 仅绑定 `127.0.0.1`，后端 `3000` 未映射到宿主机
- `sudo certbot renew --dry-run` 通过
- 已配置 HTTPS、Cloudflare Full (strict)、数据备份和容器日志保留策略
- 已用正式域名验证注册、登录、新增、刷新持久化、退出登录和账号隔离
