import os
from pathlib import Path
from typing import Dict, Tuple

import pytest
import requests


def load_dotenv(path: Path) -> Dict[str, str]:
    if not path.exists():
        return {}
    result: Dict[str, str] = {}
    for line in path.read_text().splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            result[key] = value
    return result


dotenv_path = Path(__file__).resolve().parents[1] / ".env"
for key, value in load_dotenv(dotenv_path).items():
    os.environ.setdefault(key, value)

API_BASE_URL = os.getenv("API_BASE_URL", "").rstrip("/")
API_STAGE = os.getenv("API_STAGE", "").strip().strip("/")
RUN_INTEGRATION = os.getenv("RUN_INTEGRATION", "0") == "1"
S3_BUCKET = os.getenv("S3_BUCKET", "").strip()


def build_base_url() -> str:
    base = API_BASE_URL.rstrip("/")
    if API_STAGE and not base.endswith(f"/{API_STAGE}"):
        base = f"{base}/{API_STAGE}"
    return base


BASE_URL = build_base_url()


def require_integration() -> None:
    if not RUN_INTEGRATION or not API_BASE_URL:
        pytest.skip("Set RUN_INTEGRATION=1 and API_BASE_URL to run live tests.")


def assert_ok(response: requests.Response, url: str) -> None:
    if response.status_code != 200:
        hint = ""
        if response.status_code == 404 and API_STAGE:
            hint = f" Check that API_STAGE='{API_STAGE}' is correct."
        elif response.status_code == 404 and not API_STAGE:
            hint = " If your API has a stage path, set API_STAGE (e.g. prod)."
        raise AssertionError(f"Expected 200 from {url}, got {response.status_code}.{hint}")


def load_sample_image() -> Tuple[bytes, str, str]:
    image_path = Path(__file__).resolve().parents[2] / "src/assets/test_assets/product-photo-standard-9-16.jpg"
    content = image_path.read_bytes()
    return content, image_path.name, "image/jpeg"


def upload_sample_image() -> str:
    content, name, content_type = load_sample_image()
    response = requests.post(
        f"{BASE_URL}/upload",
        files={"file": (name, content, content_type)},
        timeout=(30, 120),
    )
    assert_ok(response, f"{BASE_URL}/upload")
    payload = response.json()
    print("UPLOAD RESPONSE:", payload)
    url = payload.get("url")
    assert url
    if S3_BUCKET:
        assert f"{S3_BUCKET}.s3." in url
        assert "/uploads/" in url
    return url


def test_live_upload() -> None:
    require_integration()
    upload_sample_image()


def test_live_generate_and_status() -> None:
    require_integration()
    input_url = upload_sample_image()
    response = requests.post(
        f"{BASE_URL}/generate",
        json={
            "input_url": input_url,
            "prompt": "minimal shadow play on a dark studio table",
            "aspect_ratio": "1:1",
            "resolution": "1K",
        },
        timeout=(30, 120),
    )
    assert_ok(response, f"{BASE_URL}/generate")
    payload = response.json()
    print("GENERATE RESPONSE:", payload)
    task_id = payload.get("data", {}).get("taskId") or payload.get("data", {}).get("recordId")
    assert task_id

    status = requests.get(
        f"{BASE_URL}/status",
        params={"task_id": task_id},
        timeout=(30, 60),
    )
    assert_ok(status, f"{BASE_URL}/status")
    print("STATUS RESPONSE:", status.json())


def test_live_proxy() -> None:
    require_integration()
    url = f"{BASE_URL}/proxy"
    response = requests.get(url, params={"url": "https://example.com"}, timeout=30)
    assert_ok(response, url)
    print("PROXY STATUS:", response.status_code, "CONTENT-TYPE:", response.headers.get("content-type"))


def test_live_vecteezy_resources() -> None:
    require_integration()
    url = f"{BASE_URL}/vecteezy/resources"
    response = requests.get(url, params={"term": "leaf"}, timeout=30)
    assert_ok(response, url)
    print("VECTEEZY RESPONSE:", response.json())
