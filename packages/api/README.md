# AI Clash API

Backend service for AI Clash server-side features. The first module stores public share snapshots for `/share/:id`.

## Local Setup

1. Copy `.env.example` to `.env` and fill in MySQL credentials.
2. Start the development server:

```bash
bun --filter @ai-clash/api dev
```

For production-like local testing, build and run the compiled output:

```bash
bun --filter @ai-clash/api build
node packages/api/dist/index.js
```

Apply migrations after building:

```bash
cd packages/api
node dist/migrate.js
```

## API

### `GET /healthz`

Returns service health.

### `POST /api/shares`

Creates a public share snapshot. Request body is a `ShareSnapshot` JSON object.

### `GET /api/shares/:id`

Returns a public share snapshot.

### `DELETE /api/shares/:id`

Deletes a snapshot. Pass the delete token through `x-delete-token` or `?token=`.

## Deployment

Build from the repository root:

```bash
docker build -f packages/api/Dockerfile -t registry.cn-shanghai.aliyuncs.com/snewbie/ai-clash-api:latest .
```

On the server, keep `.env` next to `docker-compose.yml`, then run:

```bash
docker compose pull
docker compose up -d
```
