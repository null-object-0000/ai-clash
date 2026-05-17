FROM oven/bun:1.3.3 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/api/package.json packages/api/package.json
RUN cd packages/api && bun install --frozen-lockfile

FROM oven/bun:1.3.3 AS build
WORKDIR /app
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY package.json tsconfig.json ./
COPY packages/api ./packages/api
RUN bun --filter @ai-clash/api build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/packages/api/node_modules ./node_modules
COPY --from=build /app/packages/api/dist ./dist
COPY packages/api/package.json ./package.json
COPY packages/api/migrations ./migrations
EXPOSE 8080
CMD ["node", "dist/index.js"]
