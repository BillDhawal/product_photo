"""
Backend API client for upload, generate, and status polling.
Uses BACKEND_URL from env (default: http://localhost:8000).
"""
import json
import time
from pathlib import Path
from typing import Optional

import requests


def get_backend_url() -> str:
    import os
    from pathlib import Path
    env_path = Path(__file__).resolve().parents[1] / "backend" / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line.startswith("API_BASE_URL=") or line.startswith("VITE_API_BASE_URL="):
                url = line.split("=", 1)[1].strip().strip('"').strip("'")
                if url:
                    return url.rstrip("/")
    return os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")


def upload_image(file_path: Path, backend_url: Optional[str] = None) -> str:
    """Upload image file to backend. Returns public URL."""
    base = backend_url or get_backend_url()
    path = Path(file_path).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {path}")
    content = path.read_bytes()
    name = path.name
    content_type = "image/jpeg" if path.suffix.lower() in (".jpg", ".jpeg") else "image/png"
    response = requests.post(
        f"{base}/upload",
        files={"file": (name, content, content_type)},
        timeout=(30, 120),
    )
    response.raise_for_status()
    payload = response.json()
    url = payload.get("url")
    if not url:
        raise RuntimeError(f"Upload response missing url: {payload}")
    if url.startswith("/"):
        url = f"{base.rstrip('/')}{url}"
    return url


def create_generate_task(
    input_url: str,
    prompt: str,
    model: str = "nano-banana-pro",
    aspect_ratio: str = "4:3",
    resolution: str = "1K",
    output_format: Optional[str] = None,
    backend_url: Optional[str] = None,
) -> str:
    """Create generation task. Returns task_id."""
    base = backend_url or get_backend_url()
    if model == "nano-banana-pro":
        payload = {
            "model": model,
            "prompt": prompt,
            "image_input": [input_url],
            "aspect_ratio": aspect_ratio,
            "resolution": resolution,
            "output_format": output_format or "png",
        }
    else:
        payload = {
            "model": model,
            "input_url": input_url,
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "resolution": resolution,
        }
    response = requests.post(
        f"{base}/generate",
        json=payload,
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    task_id = data.get("data", {}).get("taskId") or data.get("data", {}).get("recordId")
    if not task_id:
        raise RuntimeError(f"Generate response missing taskId: {data}")
    return task_id


def poll_status(task_id: str, backend_url: Optional[str] = None, max_wait_sec: int = 120) -> list[str]:
    """Poll /status until success or fail. Returns list of result URLs."""
    base = backend_url or get_backend_url()
    start = time.time()
    while time.time() - start < max_wait_sec:
        response = requests.get(
            f"{base}/status",
            params={"task_id": task_id},
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        state = data.get("data", {}).get("state")
        if state == "success":
            result_json = data.get("data", {}).get("resultJson") or "{}"
            try:
                parsed = json.loads(result_json)
                return parsed.get("resultUrls", [])
            except json.JSONDecodeError:
                return []
        if state == "fail":
            raise RuntimeError(f"Generation failed: {data}")
        time.sleep(3)
    raise TimeoutError(f"Generation timed out after {max_wait_sec}s")
