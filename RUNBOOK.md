# AnchorProposal Operations Runbook

## Local Development

1. Start PostgreSQL and Redis: `docker compose up -d`
2. Install: `npm install`
3. Migrate: `cd apps/api && npx prisma migrate deploy && npm run db:seed`
4. Run: `npm run dev` from root

## Production Deployment

### Pre-deploy Checklist

- [ ] Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET`
- [ ] Configure `DEEPSEEK_API_KEY` in environment (not in source control)
- [ ] Run database migrations: `npx prisma migrate deploy`
- [ ] Verify backup/restore procedure
- [ ] Configure monitoring for API latency, queue depth, generation failures

### Services

| Service | Port | Notes |
|---------|------|-------|
| Web (Next.js) | 3000 | Static + SSR |
| API (NestJS) | 3001 | REST API |
| PostgreSQL | 5432 | Primary data store |
| Redis | 6379 | BullMQ job queue |

### Generation Pipeline Monitoring

Watch for:
- Queue depth on `resume-generation` queue
- `FAILED` generation status count
- DeepSeek API latency and error rate
- Puppeteer memory usage during PDF rendering

### Rollback

1. Revert deployment artifact
2. Run backward-compatible migration if needed
3. Clear stuck jobs in Redis: `redis-cli KEYS bull:resume-generation:*`

### Backup

- PostgreSQL: daily automated backups
- File storage (`./storage/resumes/`): sync to durable storage

## Troubleshooting

| Issue | Resolution |
|-------|------------|
| Generation stuck in QUEUED | Check Redis connection and BullMQ worker |
| PDF render fails | Ensure Puppeteer/Chromium dependencies installed |
| 401 on API calls | Token expired; refresh or re-login |
| Duplicate warning on valid company | Review normalization rules in warning settings |
