# ── 前端构建阶段 ──────────────────────────────
FROM node:24-bookworm-slim AS frontend-builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.6.3 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# ── 后端构建阶段 ──────────────────────────────
FROM node:24-bookworm-slim AS backend-builder

WORKDIR /app/server

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/ .
RUN npm run build && npm prune --omit=dev

# ── 单容器生产阶段 ─────────────────────────────
FROM node:24-bookworm-slim AS production

WORKDIR /app

ARG APP_VERSION=1.0.0
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_DIR=/app/data
ENV FRONTEND_DIR=/app/public
ENV APP_VERSION=${APP_VERSION}

COPY --from=backend-builder --chown=node:node /app/server/dist ./dist
COPY --from=backend-builder --chown=node:node /app/server/node_modules ./node_modules
COPY --from=backend-builder --chown=node:node /app/server/package.json ./package.json
COPY --from=frontend-builder --chown=node:node /app/dist ./public

RUN mkdir -p /app/data && chown node:node /app/data

EXPOSE 3000

USER node

CMD ["node", "dist/app.js"]
