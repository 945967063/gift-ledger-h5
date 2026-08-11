# ── 前端构建阶段 ──────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code and build
COPY . .
RUN pnpm run build

# ── 生产 Nginx 镜像 ───────────────────────────────────────────
FROM nginx:alpine AS production

# Copy built frontend
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy Nginx config
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
