# AI Clash API

Spring Boot backend service for AI Clash server-side features.

## Requirements

- JDK 25
- Maven 3.9+
- MySQL 8+

## Local Development

Copy `.env.example` to `.env`, fill in the MySQL dev database and GitHub OAuth values, then run:

```bash
cd packages/api
mvn spring-boot:run
```

The service listens on `http://localhost:8080`.

## API

- `GET /healthz`
- `GET /api/auth/me`
- `GET /api/auth/github/start`
- `GET /api/auth/github/callback`
- `POST /api/auth/logout`
- `POST /api/shares`
- `GET /api/shares/:id`
- `DELETE /api/shares/:id`

Database migrations run automatically on startup from `src/main/resources/migrations`.
