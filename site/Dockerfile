# syntax=docker/dockerfile:1
# One image runs both the API (default) and the background worker
# (override the command with `node dist-server/worker.js`).

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production APP_ENV=production PORT=8787 WEB_ROOT=/app/dist
WORKDIR /app
RUN useradd --system --uid 10001 armoire
COPY --from=build --chown=armoire /app/node_modules ./node_modules
COPY --from=build --chown=armoire /app/dist ./dist
COPY --from=build --chown=armoire /app/dist-server ./dist-server
COPY --from=build --chown=armoire /app/package.json ./package.json
USER armoire
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist-server/index.js"]
