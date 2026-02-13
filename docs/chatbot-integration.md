# Chatbot Integration: Backend + AWS

Step-by-step guide to integrate the LangGraph chatbot with the real backend and deploy to AWS.

**Verified working.** See `deploy-backend-steps.md` for the exact deployment commands (arm64 Lambda, ECR, API Gateway).

---

## Overview

The test script (`test_script/chatbot.py`) already works with the backend APIs. Integration means:

1. **Backend**: Add `/chat` endpoint that runs the agent and returns responses
2. **AWS**: Rebuild container with new dependencies, update Lambda config, add API Gateway route
3. **Frontend**: Wire the chat UI to call `/chat` (covered in a follow-up)

---

## Part 1: Backend Changes

### 1.1 Add Dependencies

Add to `backend/requirements.txt`:

```
langgraph>=0.2.0
langchain>=0.3.0
langchain-openai>=0.2.0
langchain-core>=0.3.0
```

### 1.2 Add Chat Module

Create `backend/agent.py` with the agent logic (adapted from `test_script/chatbot.py`). The agent:

- Uses `upload_product_image` and `generate_product_image` tools
- Tools call the backend's own `/upload`, `/generate`, `/status` via HTTP (using `API_BASE_URL` or `PUBLISHED_URL` env)
- Uses `MemorySaver` for conversation history (in-memory; per-thread)

### 1.3 Add `/chat` Endpoint

Add to `backend/main.py`:

```python
@app.post("/chat")
async def chat(payload: dict) -> JSONResponse:
    # payload: { "message": str, "thread_id": str?, "image_url": str? }
    # Returns: { "content": str, "thumbnails": list[str]? }
```

### 1.4 Environment Variables (Backend)

The backend needs:

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | GPT-4o for agent + vision |
| `API_BASE_URL` or `PUBLISHED_URL` | Public URL of this API (for tools to call /upload, /generate) |
| `KIE_API_KEY` | Already used for /generate |

---

## Part 2: AWS Changes

### 2.1 ECR (Elastic Container Registry)

**No new ECR repo needed.** Use the existing `product-photo-api` repository.

- Rebuild the Docker image with the new dependencies (langgraph, langchain, etc.)
- Push the updated image to the same ECR repo
- Lambda will use the new image on next deploy

**Commands** (from `backend/`):

```bash
# Get ECR login
aws ecr get-login-password --region <REGION> | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com

# Build and push (use linux/arm64 for arm64 Lambda; linux/amd64 for x86_64)
docker buildx build \
  --platform linux/arm64 \
  -t <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/product-photo-api:latest \
  --provenance=false \
  --sbom=false \
  --push \
  .

# Update Lambda to use new image
aws lambda update-function-code \
  --region <REGION> \
  --function-name product-photo-api \
  --image-uri <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/product-photo-api:latest
```

**Note:** The image will be larger (~200–400 MB more) due to langchain/langgraph. Ensure ECR storage limits are sufficient.

---

### 2.2 API Gateway

**Add one new route:**

| Method | Path | Integration |
|--------|------|-------------|
| `POST` | `/chat` | Lambda (product-photo-api) |

**If using AWS Console:**

1. API Gateway → Your API → Routes
2. Create route: `POST /chat`
3. Attach integration: Lambda function `product-photo-api`

**If using AWS CLI (HTTP API v2):**

```bash
# Get your API ID
aws apigatewayv2 get-apis --region <REGION>

# Create route for /chat
aws apigatewayv2 create-route \
  --api-id <API_ID> \
  --route-key "POST /chat" \
  --target "integrations/<INTEGRATION_ID>" \
  --region <REGION>
```

**If using Terraform/SAM:** Add `POST /chat` to the route definitions in your template.

**CORS:** If your API already allows `*` or your frontend origin, no change. Otherwise add `POST` to allowed methods (likely already covered).

---

### 2.3 Lambda Configuration

**Environment variables to add/update:**

| Variable | Value | Notes |
|----------|-------|-------|
| `OPENAI_API_KEY` | `sk-...` | **New** – required for chat |
| `API_BASE_URL` | `https://<API_ID>.execute-api.<REGION>.amazonaws.com` | **New** – public URL of this API (for tools to call /upload, /generate) |
| `KIE_API_KEY` | (existing) | Already set |
| `KIE_BASE_URL` | (existing) | Already set |
| `USE_S3` | `1` | Already set |
| `S3_BUCKET` | (existing) | Already set |
| `PUBLIC_FILE_BASE` | Same as `API_BASE_URL` or S3 URL | For upload URLs |

**Lambda timeout:** Increase to **120–180 seconds**. Chat with image generation can take 60–120+ seconds.

```bash
aws lambda update-function-configuration \
  --function-name product-photo-api \
  --timeout 180 \
  --memory-size 1024 \
  --environment "Variables={OPENAI_API_KEY=<REDACTED>,API_BASE_URL=https://<API_ID>.execute-api.<REGION>.amazonaws.com,KIE_API_KEY=<REDACTED>,KIE_BASE_URL=https://api.kie.ai,...}" \
  --region <REGION>
```

**Memory:** Consider 1024–2048 MB. LangChain/LangGraph add memory usage; 1024 MB may be tight.

---

## Part 3: Step-by-Step Deployment

### Step 1: Update Backend Code

1. Add dependencies to `backend/requirements.txt`
2. Create `backend/agent.py` (chat module)
3. Add `POST /chat` endpoint to `backend/main.py`

### Step 2: Test Locally

Add to `backend/.env`:

```
OPENAI_API_KEY=sk-...
API_BASE_URL=http://localhost:8000
```

For generation to work, KIE must fetch the uploaded image. Use a tunnel (e.g. Cloudflare) and set `API_BASE_URL` and `PUBLIC_FILE_BASE` to the tunnel URL.

```bash
cd backend
docker compose up --build
```

Test:

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What background ideas can you suggest?", "thread_id": "test-1"}'
```

### Step 3: Build and Push to ECR

```bash
cd backend
# Use linux/arm64 for arm64 Lambda (verified); linux/amd64 for x86_64
docker buildx build --platform linux/arm64 \
  -t <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/product-photo-api:latest \
  --provenance=false --sbom=false --push .
```

### Step 4: Update Lambda

```bash
aws lambda update-function-code \
  --region <REGION> \
  --function-name product-photo-api \
  --image-uri <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/product-photo-api:latest

aws lambda update-function-configuration \
  --function-name product-photo-api \
  --timeout 180 \
  --environment "Variables={OPENAI_API_KEY=...,API_BASE_URL=https://...,KIE_API_KEY=...,...}"
```

### Step 5: Add API Gateway Route

Add `POST /chat` route to your API, pointing to the same Lambda.

### Step 6: Verify

```bash
curl -X POST https://b2i80xhkba.execute-api.us-east-2.amazonaws.com/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Suggest background ideas", "thread_id": "verify-1"}'
```

Expected: `{"content":"...","thumbnails":[]}` or `{"content":"...","thumbnails":["https://..."]}`

---

## Part 4: API Contract

### POST /chat

**Request:**

```json
{
  "message": "Generate a luxury marble spa background",
  "thread_id": "user-123-session-1",
  "image_url": "https://..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | User message |
| `thread_id` | string | No | Conversation thread (default: `default`) |
| `image_url` | string | No | Pre-uploaded image URL (if user already uploaded) |

**Response:**

```json
{
  "content": "Here are some generated backgrounds for: luxury marble spa",
  "thumbnails": ["https://...", "https://..."]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `content` | string | Assistant text response |
| `thumbnails` | string[] | Result image URLs (when generation was triggered) |

---

## Part 5: Summary Checklist

- [x] Add langgraph, langchain, langchain-openai, langchain-core to `backend/requirements.txt`
- [x] Create `backend/agent.py` with agent + tools
- [x] Add `POST /chat` to `backend/main.py`
- [x] Add `OPENAI_API_KEY` and `API_BASE_URL` to Lambda env
- [x] Increase Lambda timeout to 120–180 seconds
- [x] Rebuild and push Docker image to ECR (arm64)
- [x] Update Lambda function code
- [x] Add `POST /chat` route in API Gateway
- [x] Test `/chat` endpoint

---

## Frontend Integration

The frontend (`src/App.jsx` AIChatbot) calls `POST /chat` with `message`, `thread_id`, `image_url` (from canvas snapshot), and optional `model`.

**Environment:** Set `VITE_API_BASE_URL` to your deployed API (e.g. `https://b2i80xhkba.execute-api.us-east-2.amazonaws.com`) in `.env`. See `.env.example`.

**Flow:**
1. User asks for suggestions → agent returns text (no image needed)
2. User adds product to canvas, asks to generate → agent uploads image, calls generate, returns thumbnails
3. User clicks thumbnail → applies to canvas as background
