# ── 构建阶段 ─────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app/server

COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev && npm install typescript

COPY server/ .
RUN npx tsc

# ── 生产阶段 ─────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Only copy compiled output and runtime dependencies
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/package.json ./

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_DIR=/app/data

CMD ["node", "dist/app.js"]
