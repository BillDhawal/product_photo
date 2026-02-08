# AWS Setup Guide (Lambda + S3 + API Gateway)

This guide shows how to deploy the **image generation service** securely with **S3 + Lambda + API Gateway**.

## 1) Create S3 bucket

1. Open AWS Console → S3 → **Create bucket**
2. Name: `product-photo-uploads`
3. Region: pick your closest region
4. Block public access: **OFF** (or use presigned GETs instead)

## 2) Create IAM user / role

Create an IAM role for Lambda with:

- `s3:PutObject` on `product-photo-uploads/*`
- `s3:GetObject` on `product-photo-uploads/*` (or use presigned GETs)
- `logs:*` for CloudWatch

## 3) Deploy Lambda (container image)

### Build & push to ECR

```
aws ecr create-repository --repository-name product-photo-api
```

Get the repository URI and then:

```
docker build -t product-photo-api backend
docker tag product-photo-api <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/product-photo-api:latest
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/product-photo-api:latest
```

### Create Lambda

- Runtime: **Container image**
- Image: your ECR image
- Memory: 1024 MB
- Timeout: 30–60s
- Env vars:
  - `KIE_API_KEY`
  - `KIE_BASE_URL`
  - `KIE_MODEL`
  - `USE_S3=1`
  - `S3_BUCKET=product-photo-uploads`
  - `AWS_REGION=<region>`

## 4) API Gateway

Create an HTTP API with routes:

- `POST /upload` → Lambda
- `POST /generate` → Lambda
- `GET /status` → Lambda

Enable CORS for your frontend domain.

## 5) Frontend flow

1. `POST /upload` with file (multipart)
2. Receive `url` (public or presigned)
3. `POST /generate` with `{ input_url, prompt, aspect_ratio, resolution }`
4. Poll `/status?task_id=...`
5. Display `resultUrls`

## Optional: presigned GET instead of public bucket

If you want to keep the bucket private:

- Generate **presigned GET URLs** for the uploaded file
- Send that URL to KIE (valid for 15–60 minutes)

## Local container test

```
cd backend
docker compose up --build
```

Upload a file:

```
curl -F "file=@/path/to/image.jpg" http://localhost:8000/upload
```

Call KIE:

```
curl -X POST http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "input_url": "http://localhost:8000/files/your-file.jpg",
    "prompt": "High-end product photography, keep props",
    "aspect_ratio": "4:3",
    "resolution": "1K"
  }'
```

---

# Local POC Guide (Docker + Cloudflare Tunnel)

This is a step-by-step POC guide to run the backend locally, expose files with a public URL, and call the KIE API.

## 1) Install Docker Desktop (macOS)

Install Docker Desktop (required for `docker compose`):

```
brew install --cask docker
```

Open **Docker.app** once to start the Docker daemon.

## 2) Build and run the container

From the repo root:

```
cd backend
docker compose up --build
```

Backend should be available at `http://localhost:8000`.

## 3) Configure KIE API key

Create `backend/.env`:

```
KIE_API_KEY=your_key
KIE_BASE_URL=https://api.kie.ai
KIE_MODEL=flux-2/pro-image-to-image
```

Restart the container after editing the env file:

```
docker compose down
docker compose up --build
```

## 4) Start a Cloudflare tunnel

KIE requires a **publicly reachable URL** for the reference image. Local URLs like
`http://localhost:8000/files/...` are not accessible to KIE. The tunnel exposes your local
backend to the public internet for POC testing.

Run:

```
cloudflared tunnel --url http://localhost:8000
```

Copy the public URL it prints, for example:

```
https://example.trycloudflare.com
```

## 5) Upload image (POST /upload)

Request:

```
curl -F "file=@/path/to/image.jpg" \
  http://localhost:8000/upload
```

Response:

```
{"url":"/files/abc123.jpg","filename":"abc123.jpg"}
```

## 6) Generate (POST /generate)

Build the public URL using the tunnel:

```
https://example.trycloudflare.com/files/abc123.jpg
```

Request:

```
curl -X POST http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "input_url": "https://example.trycloudflare.com/files/abc123.jpg",
    "prompt": "Preserve the exact composition and all props from the reference image. Do NOT remove or replace any props, bottle, or shadows. Only refine lighting, background texture, and overall realism.",
    "aspect_ratio": "4:3",
    "resolution": "1K"
  }'
```

Response:

```
{"code":200,"msg":"success","data":{"taskId":"<TASK_ID>","recordId":"<TASK_ID>"}}
```

## 7) Poll task status (GET /status)

Request:

```
curl "http://localhost:8000/status?task_id=<TASK_ID>"
```

Success response:

```
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "<TASK_ID>",
    "state": "success",
    "resultJson": "{\"resultUrls\":[\"https://tempfile.aiquickdraw.com/h/<ID>.png\"]}"
  }
}
```

## 8) Download result

Open the `resultUrls` link in the browser or download:

```
curl -L "https://tempfile.aiquickdraw.com/h/<ID>.png" -o output.png
```

---

# Why Cloudflare Tunnel is Required (for local POC)

KIE must fetch the input image from its servers. Local URLs (localhost) are **not reachable** outside your machine.
Cloudflare Tunnel provides a temporary public URL that forwards to your local backend. This allows KIE to access
your uploaded file without deploying to the cloud yet.

---

# Architecture (POC)

```
┌──────────────┐        ┌─────────────────────┐        ┌─────────────────────────┐
│  Web Client  │  --->  │  Local FastAPI API  │  --->  │  KIE Image Generation   │
│  (curl/FE)   │        │  (Docker, :8000)    │        │  (api.kie.ai)           │
└──────────────┘        └──────────┬──────────┘        └──────────┬──────────────┘
                                   │                              │
                                   │ public URL via               │
                                   │ Cloudflare Tunnel            │
                                   ▼                              ▼
                           https://*.trycloudflare.com     resultUrls (PNG)
```

---

# Architecture (AWS Production)

```
┌──────────────┐        ┌───────────────────┐        ┌─────────────────────────┐
│  Web Client  │  --->  │  API Gateway      │  --->  │  Lambda (FastAPI)       │
└──────────────┘        └──────────┬────────┘        └──────────┬──────────────┘
                                   │                              │
                                   │  presigned upload            │
                                   ▼                              ▼
                                S3 Bucket                    KIE Image API
                                (public or                   (api.kie.ai)
                                 presigned)
```

For production, replace Cloudflare Tunnel with **S3 + presigned URLs** or public S3 objects.

---

# Deployment Options: Terraform vs AWS SAM

## AWS SAM (recommended for this POC)
- **Best for serverless app + Lambda + API Gateway**.
- Simple workflow: template + `sam deploy`.
- Fast iteration for PoC and small teams.

## Terraform
- **Best for multi-service infrastructure** and long-term ops.
- More flexible and cloud-agnostic style.
- Heavier setup for a small PoC.

**Recommendation:** Use **AWS SAM** now for speed and simplicity. If this grows into multi-service infra, move to Terraform later.

---

# Terraform Step-by-Step (Lambda Container + S3 + API Gateway)

These steps use the Terraform config in `infra/terraform`.

## 0) Prereqs
- AWS CLI configured (`aws configure`)
- Terraform installed
- Docker Desktop running
 - The `backend/Dockerfile` includes AWS Lambda Web Adapter for Lambda compatibility

## 1) Create ECR repo (Terraform output)
```
cd infra/terraform
terraform init
```

## 2) Build & push container image
Use the ECR URL from Terraform outputs:
```
cd backend
docker build -t product-photo-api .
aws ecr get-login-password --region <REGION> | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com
docker tag product-photo-api <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/product-photo-api:latest
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/product-photo-api:latest
```

## 3) Deploy infrastructure
```
cd infra/terraform
terraform apply \
  -var "aws_region=<REGION>" \
  -var "account_id=<ACCOUNT_ID>" \
  -var "image_uri=<ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/product-photo-api:latest" \
  -var "kie_api_key=<KIE_API_KEY>"
```

## 4) Get API endpoint
```
terraform output api_endpoint
```

## 5) Test endpoints
Upload:
```
curl -F "file=@/path/to/image.jpg" https://<API_URL>/upload
```

Generate:
```
curl -X POST https://<API_URL>/generate \
  -H "Content-Type: application/json" \
  -d '{
    "input_url": "https://<S3_URL_FROM_UPLOAD>",
    "prompt": "Preserve props, refine lighting",
    "aspect_ratio": "4:3",
    "resolution": "1K"
  }'
```

Status:
```
curl "https://<API_URL>/status?task_id=<TASK_ID>"
```

---

# AWS SAM Step-by-Step (Container Lambda + S3 + API Gateway)

## 0) Prereqs
Install and configure:
- AWS CLI
- Docker Desktop (for container build)
- AWS credentials: `aws configure`

## 1) Create S3 bucket
```
aws s3 mb s3://product-photo-uploads --region <REGION>
```

## 2) Create ECR repo
```
aws ecr create-repository --repository-name product-photo-api --region <REGION>
```

## 3) Build & push container image
```
cd backend
docker build -t product-photo-api .
aws ecr get-login-password --region <REGION> | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com
docker tag product-photo-api <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/product-photo-api:latest
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/product-photo-api:latest
```

## 4) Create SAM template (template.yaml)
Create a `template.yaml` at repo root:

```
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Product Photo API (Lambda + API Gateway)

Globals:
  Function:
    Timeout: 60
    MemorySize: 1024

Resources:
  ProductPhotoApi:
    Type: AWS::Serverless::Function
    Properties:
      PackageType: Image
      ImageUri: <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/product-photo-api:latest
      Environment:
        Variables:
          KIE_API_KEY: "<KIE_API_KEY>"
          KIE_BASE_URL: "https://api.kie.ai"
          KIE_MODEL: "flux-2/pro-image-to-image"
          USE_S3: "1"
          S3_BUCKET: "product-photo-uploads"
          AWS_REGION: "<REGION>"
      Policies:
        - S3WritePolicy:
            BucketName: product-photo-uploads
        - S3ReadPolicy:
            BucketName: product-photo-uploads
      Events:
        ApiUpload:
          Type: Api
          Properties:
            Path: /upload
            Method: post
        ApiGenerate:
          Type: Api
          Properties:
            Path: /generate
            Method: post
        ApiStatus:
          Type: Api
          Properties:
            Path: /status
            Method: get
```

## 5) Deploy with SAM
```
sam deploy --guided
```
Follow the prompts:
- Stack name: `product-photo-api`
- Region: `<REGION>`
- Confirm changes
- Save config

## 6) Get API endpoint
```
aws cloudformation describe-stacks \
  --stack-name product-photo-api \
  --query "Stacks[0].Outputs"
```
Use the API Gateway URL for requests.

## 7) Test endpoints

Upload:
```
curl -F "file=@/path/to/image.jpg" https://<API_URL>/upload
```

Generate:
```
curl -X POST https://<API_URL>/generate \
  -H "Content-Type: application/json" \
  -d '{
    "input_url": "https://<S3_OR_PUBLIC_URL>",
    "prompt": "Preserve props, refine lighting",
    "aspect_ratio": "4:3",
    "resolution": "1K"
  }'
```

Status:
```
curl "https://<API_URL>/status?task_id=<TASK_ID>"
```
