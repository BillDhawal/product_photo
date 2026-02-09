import os
import uuid
from pathlib import Path
from typing import Optional

import requests
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles


APP_TITLE = "Product Photo API"
KIE_BASE_URL = os.getenv("KIE_BASE_URL", "https://api.kie.ai")
KIE_API_KEY = os.getenv("KIE_API_KEY", "")
KIE_MODEL = os.getenv("KIE_MODEL", "flux-2/pro-image-to-image")
USE_S3 = os.getenv("USE_S3", "0") == "1"
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/data/uploads"))
PUBLIC_FILE_BASE = os.getenv("PUBLIC_FILE_BASE", "")


app = FastAPI(title=APP_TITLE)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/files", StaticFiles(directory=UPLOAD_DIR), name="files")


def require_api_key() -> None:
    if not KIE_API_KEY:
        raise HTTPException(status_code=500, detail="KIE_API_KEY is not configured")


def get_public_url(filename: str) -> str:
    if PUBLIC_FILE_BASE:
        return f"{PUBLIC_FILE_BASE.rstrip('/')}/{filename}"
    return f"/files/{filename}"


def upload_to_s3(file_path: Path, content_type: str) -> str:
    import boto3

    bucket = os.getenv("S3_BUCKET")
    region = os.getenv("AWS_REGION", "us-east-1")
    if not bucket:
        raise HTTPException(status_code=500, detail="S3_BUCKET is not configured")

    s3 = boto3.client("s3", region_name=region)
    key = f"uploads/{file_path.name}"
    s3.upload_file(
        Filename=str(file_path),
        Bucket=bucket,
        Key=key,
        ExtraArgs={"ContentType": content_type},
    )
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)) -> JSONResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    ext = Path(file.filename).suffix or ".png"
    filename = f"{uuid.uuid4().hex}{ext}"
    target = UPLOAD_DIR / filename
    content = await file.read()
    target.write_bytes(content)

    public_url = upload_to_s3(target, file.content_type) if USE_S3 else get_public_url(filename)
    return JSONResponse({"url": public_url, "filename": filename})


@app.post("/generate")
def create_task(payload: dict) -> JSONResponse:
    require_api_key()
    input_url = payload.get("input_url")
    prompt = payload.get("prompt")
    aspect_ratio = payload.get("aspect_ratio", "4:3")
    resolution = payload.get("resolution", "1K")
    model = payload.get("model", KIE_MODEL)

    if not input_url or not prompt:
        raise HTTPException(status_code=400, detail="input_url and prompt are required")

    response = requests.post(
        f"{KIE_BASE_URL}/api/v1/jobs/createTask",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {KIE_API_KEY}",
        },
        json={
            "model": model,
            "input": {
                "input_urls": [input_url],
                "prompt": prompt,
                "aspect_ratio": aspect_ratio,
                "resolution": resolution,
            },
        },
        timeout=60,
    )
    if not response.ok:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return JSONResponse(response.json())


@app.get("/status")
def task_status(task_id: str) -> JSONResponse:
    require_api_key()
    response = requests.get(
        f"{KIE_BASE_URL}/api/v1/jobs/recordInfo",
        headers={"Authorization": f"Bearer {KIE_API_KEY}"},
        params={"taskId": task_id},
        timeout=60,
    )
    if not response.ok:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return JSONResponse(response.json())


@app.get("/proxy")
def proxy_asset(url: str) -> StreamingResponse:
    if not url:
        raise HTTPException(status_code=400, detail="Missing url")
    try:
        response = requests.get(url, stream=True, timeout=30)
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if not response.ok:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    content_type = response.headers.get("content-type", "application/octet-stream")
    return StreamingResponse(response.iter_content(chunk_size=1024 * 256), media_type=content_type)
