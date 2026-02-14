import logging
import os
import uuid
from pathlib import Path
from typing import Optional

import requests

# Logs go to stderr → CloudWatch
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles


APP_TITLE = "Product Photo API"
KIE_BASE_URL = os.getenv("KIE_BASE_URL", "https://api.kie.ai")
KIE_API_KEY = os.getenv("KIE_API_KEY", "")
KIE_MODEL = os.getenv("KIE_MODEL", "flux-2/pro-image-to-image")
USE_S3 = os.getenv("USE_S3", "0") == "1"
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/data/uploads"))
PUBLIC_FILE_BASE = os.getenv("PUBLIC_FILE_BASE", "")
VECTEEZY_API_KEY = os.getenv("VECTEEZY_API_KEY", "")
VECTEEZY_ACCOUNT_ID = os.getenv("VECTEEZY_ACCOUNT_ID", "")
VECTEEZY_BASE_URL = "https://api.vecteezy.com"


app = FastAPI(title=APP_TITLE)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
except OSError:
    # Lambda runtime filesystem is read-only except /tmp.
    UPLOAD_DIR = Path("/tmp/uploads")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/files", StaticFiles(directory=UPLOAD_DIR), name="files")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "*",
}


def require_api_key() -> None:
    if not KIE_API_KEY:
        raise HTTPException(status_code=500, detail="KIE_API_KEY is not configured")


def require_vecteezy_config() -> None:
    if not VECTEEZY_API_KEY:
        raise HTTPException(status_code=500, detail="VECTEEZY_API_KEY is not configured")
    if not VECTEEZY_ACCOUNT_ID:
        raise HTTPException(status_code=500, detail="VECTEEZY_ACCOUNT_ID is not configured")


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


@app.get("/credits")
def get_credits(user_id: Optional[str] = None, user_email: Optional[str] = None) -> JSONResponse:
    """Get available credits for user. Requires user_id or user_email."""
    if not user_id and not user_email:
        return JSONResponse({"credits": 0, "error": "user_id or user_email required"}, status_code=400)
    try:
        from credits import get_credits_available, has_unlimited_credits
        if has_unlimited_credits(user_id, user_email):
            return JSONResponse({"credits": 999999, "unlimited": True})
        credits = get_credits_available(user_id or "", user_email)
        return JSONResponse({"credits": credits, "unlimited": False})
    except Exception as e:
        log.exception("get_credits failed: %s", e)
        return JSONResponse({"credits": 8, "error": str(e)})  # Return 8 on error so UI works


@app.get("/health/details")
def health_details() -> dict:
    kie_configured = bool(KIE_API_KEY)
    vecteezy_configured = bool(VECTEEZY_API_KEY and VECTEEZY_ACCOUNT_ID)
    openai_configured = bool(os.getenv("OPENAI_API_KEY"))
    upload_dir_writable = UPLOAD_DIR.exists() and os.access(UPLOAD_DIR, os.W_OK)
    return {
        "status": "ok",
        "dependencies": {
            "kie_api_key_configured": kie_configured,
            "vecteezy_configured": vecteezy_configured,
            "openai_configured": openai_configured,
            "public_file_base_configured": bool(PUBLIC_FILE_BASE),
            "use_s3": USE_S3,
            "s3_bucket_configured": bool(os.getenv("S3_BUCKET")),
            "upload_dir": str(UPLOAD_DIR),
            "upload_dir_writable": upload_dir_writable,
        },
    }


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
    quality = payload.get("quality")
    model = payload.get("model", KIE_MODEL)
    image_size = payload.get("image_size")
    rendering_speed = payload.get("rendering_speed")
    style = payload.get("style")
    num_images = payload.get("num_images")
    seed = payload.get("seed")
    image_input = payload.get("image_input")
    output_format = payload.get("output_format")

    if model == "ideogram/v3-reframe":
        if not input_url or not image_size:
            raise HTTPException(
                status_code=400,
                detail="input_url and image_size are required for ideogram/v3-reframe",
            )
        input_payload = {
            "image_url": input_url,
            "image_size": image_size,
            **({"rendering_speed": rendering_speed} if rendering_speed else {}),
            **({"style": style} if style else {}),
            **({"num_images": num_images} if num_images else {}),
            **({"seed": seed} if seed is not None else {}),
        }
    elif model == "nano-banana-pro":
        if not prompt:
            raise HTTPException(status_code=400, detail="prompt is required for nano-banana-pro")
        input_payload = {
            "prompt": prompt,
            **({"image_input": image_input} if image_input else {}),
            **({"aspect_ratio": aspect_ratio} if aspect_ratio else {}),
            **({"resolution": resolution} if resolution else {}),
            **({"output_format": output_format} if output_format else {}),
        }
    else:
        if not input_url or not prompt:
            raise HTTPException(status_code=400, detail="input_url and prompt are required")
        input_payload = {
            "input_urls": [input_url],
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "resolution": resolution,
            **({"quality": quality} if quality else {}),
        }

    response = requests.post(
        f"{KIE_BASE_URL}/api/v1/jobs/createTask",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {KIE_API_KEY}",
        },
        json={
            "model": model,
            "input": input_payload,
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
def proxy_asset(url: Optional[str] = None) -> StreamingResponse:
    if not url:
        raise HTTPException(status_code=400, detail="Missing url", headers=CORS_HEADERS)
    try:
        response = requests.get(url, stream=True, timeout=30)
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=str(exc), headers=CORS_HEADERS) from exc
    if not response.ok:
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text,
            headers=CORS_HEADERS,
        )
    content_type = response.headers.get("content-type", "application/octet-stream")
    return StreamingResponse(
        response.iter_content(chunk_size=1024 * 256),
        media_type=content_type,
        headers=CORS_HEADERS,
    )


@app.options("/proxy")
def proxy_options() -> Response:
    return Response(
        headers=CORS_HEADERS
    )


def _require_openai() -> None:
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")


@app.post("/chat")
async def chat(payload: dict) -> JSONResponse:
    """Chat with the product photography agent. Payload: { message, thread_id?, image_url?, model? }."""
    _require_openai()
    message = payload.get("message")
    if not message or not isinstance(message, str):
        raise HTTPException(status_code=400, detail="message is required and must be a string")
    thread_id = payload.get("thread_id") or "default"
    image_url = payload.get("image_url")
    model = payload.get("model")
    aspect_ratio = payload.get("aspect_ratio")
    num_images = payload.get("num_images", 4)
    user_id = payload.get("user_id")
    user_email = payload.get("user_email")
    if isinstance(num_images, (int, float)):
        num_images = int(num_images)
    else:
        num_images = 4
    log.info("chat request thread_id=%s has_image=%s model=%s aspect_ratio=%s num_images=%d msg_len=%d", thread_id, bool(image_url), model, aspect_ratio, num_images, len(message))

    try:
        from agent import chat_turn
        out = chat_turn(message=message, thread_id=thread_id, image_url=image_url, model=model, aspect_ratio=aspect_ratio, num_images=num_images, user_id=user_id, user_email=user_email)
        thumb_count = len(out.get("thumbnails", []))
        log.info("chat response thumbnails=%d", thumb_count)
        return JSONResponse({"content": out["content"], "thumbnails": out.get("thumbnails", [])})
    except Exception as exc:
        err_str = str(exc)
        log.exception("chat failed: %s", err_str)
        # Retry with fresh thread if corrupted checkpoint (tool_calls without response)
        if "tool_call" in err_str.lower() and "tool_call_id" in err_str:
            try:
                fresh_id = f"{thread_id}-{uuid.uuid4().hex[:8]}"
                out = chat_turn(message=message, thread_id=fresh_id, image_url=image_url, model=model, aspect_ratio=aspect_ratio, num_images=num_images, user_id=user_id, user_email=user_email)
                return JSONResponse({"content": out["content"], "thumbnails": out.get("thumbnails", [])})
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=err_str) from exc


@app.get("/vecteezy/resources")
def vecteezy_resources(
    term: str,
    content_type: str = "png",
    page: int = 1,
    per_page: int = 12,
    sort_by: str = "relevance",
    license_type: str = "commercial",
    ai_generated: Optional[bool] = None,
) -> JSONResponse:
    require_vecteezy_config()
    if per_page > 100:
        per_page = 100
    if page < 1:
        page = 1

    params = {
        "term": term,
        "content_type": content_type,
        "page": page,
        "per_page": per_page,
        "sort_by": sort_by,
        "license_type": license_type,
    }
    if ai_generated is not None:
        params["ai_generated"] = ai_generated

    response = requests.get(
        f"{VECTEEZY_BASE_URL}/v2/{VECTEEZY_ACCOUNT_ID}/resources",
        headers={
            "accept": "application/json",
            "Authorization": f"Bearer {VECTEEZY_API_KEY}",
        },
        params=params,
        timeout=60,
    )
    if not response.ok:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return JSONResponse(response.json())
