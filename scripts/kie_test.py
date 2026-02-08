import json
import os
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

import requests


KIE_API_KEY = os.getenv("KIE_API_KEY")
MODEL = "flux-2/pro-image-to-image"
BASE_URL = "https://api.kie.ai"
DEFAULT_PROMPT = (
    "Preserve the exact composition and all props from the reference image. "
    "Do NOT remove or replace any props, bottle, or shadows. "
    "Only refine lighting, background texture, and overall realism. "
    "Keep the product centered and maintain prop positions."
)


def upload_to_transfer_sh(file_path: Path) -> str:
    with file_path.open("rb") as handle:
        response = requests.put(
            f"https://transfer.sh/{file_path.name}",
            data=handle,
            headers={"Content-Type": "application/octet-stream"},
            timeout=60,
        )
    response.raise_for_status()
    return response.text.strip()


def upload_to_0x0(file_path: Path) -> str:
    with file_path.open("rb") as handle:
        response = requests.post(
            "https://0x0.st",
            files={"file": (file_path.name, handle)},
            timeout=60,
        )
    response.raise_for_status()
    return response.text.strip()


def upload_to_file_io(file_path: Path) -> str:
    with file_path.open("rb") as handle:
        response = requests.post(
            "https://file.io",
            files={"file": (file_path.name, handle)},
            timeout=60,
        )
    response.raise_for_status()
    payload = response.json()
    url = payload.get("link") or payload.get("url")
    if not url:
        raise RuntimeError(f"file.io response missing link: {payload}")
    return url


def upload_image(file_path: Path) -> str:
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    errors = []
    for uploader in (upload_to_transfer_sh, upload_to_0x0, upload_to_file_io):
        try:
            return uploader(file_path)
        except Exception as exc:  # noqa: BLE001 - best-effort fallback
            errors.append(f"{uploader.__name__}: {exc}")

    raise RuntimeError("Upload failed. " + " | ".join(errors))


def create_task(input_url: str, prompt: str, aspect_ratio: str, resolution: str) -> dict:
    if not KIE_API_KEY:
        raise RuntimeError("Missing KIE_API_KEY in environment.")
    payload = {
        "model": MODEL,
        "input": {
            "input_urls": [input_url],
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "resolution": resolution,
        },
    }
    response = requests.post(
        f"{BASE_URL}/api/v1/jobs/createTask",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {KIE_API_KEY}",
        },
        data=json.dumps(payload),
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def verify_image_url(input_url: str) -> None:
    response = requests.get(input_url, stream=True, timeout=30)
    response.raise_for_status()
    content_type = response.headers.get("Content-Type", "")
    content_length = response.headers.get("Content-Length")
    print("Input URL content-type:", content_type or "unknown")
    if content_length:
        print("Input URL size:", f"{int(content_length) / (1024 * 1024):.2f} MB")
    if not content_type.startswith("image/"):
        raise RuntimeError(
            f"Input URL is not an image. Content-Type={content_type!r}. "
            "Verify the URL serves a PNG/JPEG/WEBP."
        )


def sanitize_image_url(input_url: str, fmt: str = "PNG") -> str:
    """
    Download the image and re-encode it as PNG, then upload it.
    Requires Pillow. If Pillow is not installed, raises an error with guidance.
    """
    try:
        from PIL import Image
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            "Pillow is required for image sanitization. Install with: "
            ".venv/bin/pip install pillow"
        ) from exc

    response = requests.get(input_url, stream=True, timeout=60)
    response.raise_for_status()
    suffix = ".png" if fmt.upper() == "PNG" else ".jpg"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        with Image.open(response.raw) as img:
            if fmt.upper() == "PNG":
                img = img.convert("RGBA")
                img.save(tmp_path, format="PNG")
            else:
                img = img.convert("RGB")
                img.save(tmp_path, format="JPEG", quality=92, optimize=True)
        return upload_image(tmp_path)
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass

def query_task(task_id: str) -> dict:
    if not KIE_API_KEY:
        raise RuntimeError("Missing KIE_API_KEY in environment.")
    response = requests.get(
        f"{BASE_URL}/api/v1/jobs/recordInfo",
        headers={"Authorization": f"Bearer {KIE_API_KEY}"},
        params={"taskId": task_id},
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def download_results(result_urls: list[str], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for idx, url in enumerate(result_urls, start=1):
        response = requests.get(url, stream=True, timeout=60)
        response.raise_for_status()
        suffix = Path(url.split("?")[0]).suffix or ".png"
        filename = f"kie_result_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{idx}{suffix}"
        target = output_dir / filename
        with target.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    handle.write(chunk)
        print("Downloaded:", target)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python scripts/kie_test.py <image_path> [prompt]")
        sys.exit(1)

    image_path = Path(sys.argv[1]).expanduser()
    prompt = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_PROMPT
    aspect_ratio = os.getenv("KIE_ASPECT_RATIO", "4:3")
    resolution = os.getenv("KIE_RESOLUTION", "1K")

    input_url = os.getenv("KIE_INPUT_URL")
    if input_url:
        print("Using KIE_INPUT_URL:", input_url)
        if os.getenv("KIE_SKIP_VALIDATE") == "1":
            print("Skipping image validation (KIE_SKIP_VALIDATE=1).")
        else:
            try:
                verify_image_url(input_url)
            except Exception as exc:
                print("Image validation failed:", exc)
                print("Sanitizing image and re-uploading...")
                input_url = sanitize_image_url(input_url, fmt="PNG")
                print("Sanitized upload:", input_url)
    else:
        print("Uploading image...")
        input_url = upload_image(image_path)
        print("Uploaded:", input_url)
        verify_image_url(input_url)

    if os.getenv("KIE_FORCE_JPG") == "1" and not os.getenv("KIE_INPUT_URL"):
        print("Forcing JPEG sanitize and re-upload...")
        input_url = sanitize_image_url(input_url, fmt="JPG")
        print("JPEG upload:", input_url)

    print("Creating task...")
    result = create_task(input_url, prompt, aspect_ratio, resolution)
    print(json.dumps(result, indent=2))

    task_id = result.get("data", {}).get("taskId")
    if not task_id:
        return

    print("Polling task status...")
    for _ in range(30):
        status = query_task(task_id)
        state = status.get("data", {}).get("state")
        print("State:", state)
        if state in ("success", "fail"):
            print(json.dumps(status, indent=2))
            if state == "success":
                result_json = status.get("data", {}).get("resultJson") or "{}"
                try:
                    result_payload = json.loads(result_json)
                    result_urls = result_payload.get("resultUrls", [])
                except json.JSONDecodeError:
                    result_urls = []
                if result_urls:
                    download_results(result_urls, Path("outputs"))
            break
        time.sleep(3)


if __name__ == "__main__":
    main()
