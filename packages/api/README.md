# AI Clash API

Spring Boot backend service for AI Clash server-side features.

## Requirements

- JDK 25
- Maven 3.9+
- MySQL 8+

## Local Development

Set the required environment variables, then run:

```bash
cd packages/api
mvn spring-boot:run
```

The service listens on `http://localhost:8080`.

## API

- `GET /healthz`
- `POST /api/shares`
- `GET /api/shares/:id`
- `DELETE /api/shares/:id`

Database migrations run automatically on startup from `src/main/resources/migrations`.
