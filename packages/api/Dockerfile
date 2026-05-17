FROM oven/bun:1.3.3
WORKDIR /app

# Install workspace dependencies once
COPY package.json bun.lock ./
COPY packages/api/package.json packages/api/package.json
COPY packages/inject/package.json packages/inject/package.json
RUN bun install --frozen-lockfile

# Build the API package
COPY package.json tsconfig.json ./
COPY packages/api ./packages/api
RUN bun --filter @ai-clash/api build

# Runtime
ENV NODE_ENV=production
EXPOSE 8080
CMD ["bun", "run", "start"]
