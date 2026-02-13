# Backend Deployment Steps (ECR, API Gateway, Lambda)

**Verified working** (arm64 Lambda + arm64 image)

**Account ID:** 989635529126  
**Region:** us-east-2  
**API ID:** b2i80xhkba  
**Base URL:** `https://b2i80xhkba.execute-api.us-east-2.amazonaws.com`

---

## 0. Lambda Architecture (Important for Runtime.InvalidEntrypoint)

The Dockerfile uses `public.ecr.aws/lambda/python:3.12-arm64` to match arm64 Lambda. **Image architecture must match Lambda.**

Check: `aws lambda get-function-configuration --function-name product-photo-api --region us-east-2 --query Architectures`

- If Lambda is **arm64**: use `-arm64` base image and `--platform linux/arm64` (current setup)
- If Lambda is **x86_64**: use `-x86_64` base image and `--platform linux/amd64`

*Note: You cannot change an existing Lambda's architecture; use the matching image.*

---

## 1. Build and Push to ECR

```bash
cd backend

# Login to ECR
aws ecr get-login-password --region us-east-2 | \
  docker login --username AWS --password-stdin 989635529126.dkr.ecr.us-east-2.amazonaws.com

# Build and push (linux/arm64 to match Lambda; use linux/amd64 if Lambda is x86_64)
docker buildx build --platform linux/arm64 \
  -t 989635529126.dkr.ecr.us-east-2.amazonaws.com/product-photo-api:latest \
  --provenance=false --sbom=false --push .
```

---

## 2. Update Lambda Code

```bash
aws lambda update-function-code \
  --region us-east-2 \
  --function-name product-photo-api \
  --image-uri 989635529126.dkr.ecr.us-east-2.amazonaws.com/product-photo-api:latest
```

---

## 3. Add API Gateway Route

**Console:**
1. API Gateway → Your API (b2i80xhkba) → Routes
2. Create route: `POST /chat`
3. Attach integration: Lambda function `product-photo-api`

**CLI:**
```bash
# Get integration ID from an existing route (e.g. POST /upload)
aws apigatewayv2 get-routes --api-id b2i80xhkba --region us-east-2

# Create /chat route (replace <INTEGRATION_ID> with the target from a route like /upload)
aws apigatewayv2 create-route \
  --api-id b2i80xhkba \
  --route-key "POST /chat" \
  --target "integrations/<INTEGRATION_ID>" \
  --region us-east-2
```

---

## 4. Update Lambda Config (Env + Timeout)

Add `OPENAI_API_KEY` and `API_BASE_URL`. Set timeout to 180 seconds.

*Tip: Get current env vars first: `aws lambda get-function-configuration --function-name product-photo-api --region us-east-2 --query Environment.Variables` then merge in the new ones.*

```bash
aws lambda update-function-configuration \
  --function-name product-photo-api \
  --region us-east-2 \
  --timeout 180 \
  --environment "Variables={OPENAI_API_KEY=sk-...,API_BASE_URL=https://b2i80xhkba.execute-api.us-east-2.amazonaws.com,KIE_API_KEY=...,KIE_BASE_URL=https://api.kie.ai,USE_S3=1,S3_BUCKET=product-photo-uploads,PUBLIC_FILE_BASE=https://b2i80xhkba.execute-api.us-east-2.amazonaws.com,AWS_REGION=us-east-2,VECTEEZY_API_KEY=...,VECTEEZY_ACCOUNT_ID=66012}"
```

*Replace `OPENAI_API_KEY=sk-...` with your key. Include any other env vars your Lambda already uses.*

---

## 5. Verify

```bash
curl -X POST https://b2i80xhkba.execute-api.us-east-2.amazonaws.com/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What background ideas can you suggest?", "thread_id": "test-1"}'
```

---

## 6. Add Lambda Function URL (for long-running /chat – avoids 29s timeout)

Use this when chat + image generation times out via API Gateway.

### 6.1 Create Function URL (AWS Console)

1. Open **AWS Lambda** → **Functions** → **product-photo-api**
2. Go to **Configuration** tab → **Function URL** (left sidebar)
3. Click **Create function URL**
4. **Auth type:** `NONE` (or `AWS_IAM` if you want signed requests)
5. **CORS:**
   - Enable CORS: **Yes**
   - Allow origin: `*` (or your frontend origin, e.g. `https://your-app.vercel.app`)
   - Allow methods: `GET`, `POST`, `PUT`, `OPTIONS`
   - Allow headers: `*`
6. Click **Save**
7. Copy the **Function URL** (e.g. `https://abc123xyz.lambda-url.us-east-2.on.aws/`)

### 6.2 Create Function URL (AWS CLI)

```bash
aws lambda create-function-url-config \
  --function-name product-photo-api \
  --auth-type NONE \
  --cors '{"AllowOrigins":["*"],"AllowMethods":["GET","POST","PUT","OPTIONS"],"AllowHeaders":["*"]}' \
  --region us-east-2
```

Get the URL:
```bash
aws lambda get-function-url-config \
  --function-name product-photo-api \
  --region us-east-2 \
  --query FunctionUrl
```

### 6.3 Update Lambda env (so agent tools call the Function URL)

The agent calls `/upload`, `/generate`, `/status` internally. Set `API_BASE_URL` and `PUBLIC_FILE_BASE` to the Function URL:

```bash
# Get current env, then update (merge with your existing vars)
aws lambda update-function-configuration \
  --function-name product-photo-api \
  --region us-east-2 \
  --environment "Variables={...,API_BASE_URL=https://YOUR-FUNCTION-URL.lambda-url.us-east-2.on.aws,PUBLIC_FILE_BASE=https://YOUR-FUNCTION-URL.lambda-url.us-east-2.on.aws,...}"
```

### 6.4 Update frontend

In `.env`:
```
VITE_API_BASE_URL=https://YOUR-FUNCTION-URL.lambda-url.us-east-2.on.aws
VITE_PUBLIC_FILE_BASE=https://YOUR-FUNCTION-URL.lambda-url.us-east-2.on.aws
```

Rebuild the frontend. The Function URL serves all routes (`/chat`, `/upload`, `/generate`, `/status`, `/proxy`, etc.).

### 6.5 Test

```bash
curl -X POST https://YOUR-FUNCTION-URL.lambda-url.us-east-2.on.aws/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Generate with spa marble backdrop", "thread_id": "test-1"}'
```

*(Include `image_url` if testing generation – upload first via `/upload`.)*

---

## Troubleshooting: Service Unavailable (503) on /chat with Generation

**Cause:** API Gateway has a **29 second max timeout**. Chat + image generation takes 60–120+ seconds.

**Fix:** Use a **Lambda Function URL** for `/chat` instead of API Gateway. Lambda URLs have no 29s limit.

1. Lambda → product-photo-api → Configuration → Function URL → Create
2. Set `VITE_API_BASE_URL` to the Function URL (or use Function URL only for `/chat`)

See `docs/debugging-backend.md` for details.

---

## Troubleshooting: Runtime.InvalidEntrypoint

If you see `Runtime.InvalidEntrypoint` in CloudWatch:

1. **Architecture mismatch** – Lambda architecture must match the image. Use section 0 above (arm64 Lambda → arm64 image, x86_64 Lambda → x86_64 image).
2. **Rebuild and redeploy** – After changing the Dockerfile base image tag, rebuild and push, then run `aws lambda update-function-code` again.
3. **Test locally** – `docker run -p 9000:8080 989635529126.dkr.ecr.us-east-2.amazonaws.com/product-photo-api:latest` then `curl -X POST "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{}'` to verify the handler loads.

---

## Checklist

- [x] Lambda architecture is arm64 (use arm64 image + `--platform linux/arm64`)
- [ ] Build and push image to ECR
- [ ] Update Lambda function code
- [ ] Add `POST /chat` route in API Gateway
- [ ] Add `OPENAI_API_KEY` and `API_BASE_URL` to Lambda env
- [ ] Set Lambda timeout to 180 seconds
- [ ] Test `/chat` endpoint
