# AI Clash API

Spring Boot backend service for AI Clash server-side features.

## Requirements

- JDK 25
- Maven 4.0.0-rc-5+
- MySQL 8+

## Local Development

Copy `.env.example` to `.env`, fill in the MySQL dev database, then run from the repository root:

```bash
bun dev:api
```

Spring Boot imports `packages/api/.env` automatically during local startup.

The service listens on `http://localhost:8080`.

## API

- `GET /healthz`
- `GET /api/auth/me`
- `GET /api/auth/github/start`
- `GET /api/auth/github/callback`
- `POST /api/auth/logout`
- `GET /api/ai/models`
- `POST /api/ai/chat/completions`
- `POST /api/shares`
- `GET /api/shares/:id`
- `DELETE /api/shares/:id`

Database migrations run automatically on startup from `src/main/resources/migrations`.
