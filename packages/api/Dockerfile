FROM oven/bun:1.3.3
WORKDIR /app

COPY bun.lock ./
COPY packages/api ./packages/api

WORKDIR /app/packages/api
RUN bun install --frozen-lockfile
RUN bun run build

ENV NODE_ENV=production
EXPOSE 8080
CMD ["bun", "run", "start"]
