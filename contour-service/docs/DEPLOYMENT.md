# Deployment

## Local

1. Copy env config:

```bash
cp .env.example .env
```

2. Add a DEM to `fixtures/dem/sample_dem.tif`.

3. Start all services:

```bash
make up
```

Services:
- API: `http://localhost:8080`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

## Production notes

- Build image using `infra/Dockerfile`.
- Set S3 endpoint to cloud object storage.
- Put API behind CDN for tile caching.
- Run `python -m scripts.cleanup_expired` periodically (cron/job runner).
- Use Postgres and Redis as managed services.
