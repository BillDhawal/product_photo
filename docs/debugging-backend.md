# Debugging the Backend (Lambda / Chat)

## View CloudWatch Logs

All `log.info()`, `log.error()`, and `log.exception()` output goes to **CloudWatch Logs**.

### AWS Console

1. **CloudWatch** → **Log groups**
2. Find `/aws/lambda/product-photo-api`
3. Open the latest **Log stream**
4. Filter by text (e.g. `chat`, `generate`, `thumbnails`)

### AWS CLI

```bash
# List recent log streams
aws logs describe-log-streams \
  --log-group-name /aws/lambda/product-photo-api \
  --order-by LastEventTime \
  --descending \
  --limit 5 \
  --region us-east-2

# Tail logs (replace STREAM_NAME)
aws logs tail /aws/lambda/product-photo-api \
  --log-stream-name STREAM_NAME \
  --follow \
  --region us-east-2

# Filter for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/product-photo-api \
  --filter-pattern "ERROR" \
  --region us-east-2
```

## Log Messages You’ll See

| Message | Meaning |
|--------|---------|
| `chat request thread_id=... has_image=...` | Incoming chat request |
| `generate_product_image start prompt=...` | Agent started generation |
| `generate poll attempt=N state=...` | Polling KIE for result |
| `generate success urls=N` | Generation finished, N image URLs |
| `chat_turn done thumbnails=N` | Agent returning N thumbnails |
| `chat response thumbnails=N` | Response sent to client |
| `chat failed: ...` | Error (see full traceback) |

## "Service Unavailable" When Generating

**Cause:** API Gateway has a **29 second max integration timeout**. Chat + generation often takes **60–120+ seconds** (upload → KIE → poll every 3s).

**What happens:** API Gateway times out before Lambda finishes → 503 Service Unavailable.

### Fix: Use Lambda Function URL

Lambda Function URLs don’t have the 29s limit (Lambda can run up to 15 minutes).

1. **Lambda** → **product-photo-api** → **Configuration** → **Function URL**
2. Create URL (Auth: NONE or IAM)
3. Update frontend `VITE_API_BASE_URL` to the Function URL
4. Add CORS if needed (Function URL supports CORS config)

**Or** keep API Gateway for `/upload`, `/generate`, `/status`, `/proxy` (fast) and use a Function URL only for `/chat`.

### Alternative: Test Locally

Run the backend locally so there’s no timeout:

```bash
cd backend
docker compose up --build
```

Set `VITE_API_BASE_URL=http://localhost:8000` in `.env` and test generation.

## Thumbnails Not Showing

1. **Check CloudWatch** – Look for `chat_turn done thumbnails=N`. If N=0, the agent isn’t extracting URLs.
2. **Check KIE response** – `generate success urls=N` confirms KIE returned URLs.
3. **Frontend proxy** – Thumbnails use `getCanvasSafeUrl()` → `/proxy?url=...`. Ensure `VITE_ENABLE_PROXY=1` and `VITE_API_BASE_URL` points to the backend.
4. **CORS** – If images load in a new tab but not in the app, it may be CORS. The proxy avoids this.

## Local Debugging

```bash
cd backend
docker compose up --build
```

Logs appear in the terminal. Test:

```bash
# Quick (no generation)
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What background ideas?", "thread_id": "local-1"}'

# With image (upload first, then use URL in chat)
curl -X POST http://localhost:8000/upload -F "file=@/path/to/image.jpg"
# Use the returned URL in image_url
```
