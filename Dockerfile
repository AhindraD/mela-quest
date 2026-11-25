FROM node:24.11.1-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN mkdir -p public && npm run build

FROM base AS runtime
ENV NODE_ENV=production
ENV MELA_HOST=0.0.0.0 PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/next.config.ts /app/tsconfig.json ./
COPY --from=build /app/server.mts ./server.mts
COPY --from=build /app/src ./src
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(async (res) => { if (!res.ok || (await res.json()).status !== 'ok') process.exitCode = 1; }).catch(() => { process.exitCode = 1; })"]
CMD ["node", "server.mts"]
