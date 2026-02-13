"""
LangGraph ReAct agent for product photography chat.
Runs inside the backend; tools call /upload, /generate, /status via HTTP.
"""
import base64
import contextvars
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

log = logging.getLogger(__name__)

# Request-scoped aspect ratio (from canvas); tools read this
_aspect_ratio_ctx: contextvars.ContextVar[str | None] = contextvars.ContextVar("aspect_ratio", default=None)
# Request-scoped number of images to generate (default 4)
_num_images_ctx: contextvars.ContextVar[int] = contextvars.ContextVar("num_images", default=4)
import json
import os
import time
import uuid
import warnings
from pathlib import Path

warnings.filterwarnings("ignore", category=UserWarning, module="langchain_core")
warnings.filterwarnings("ignore", message=".*create_react_agent.*")

import requests
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver

try:
    from langchain.agents import create_agent
    AGENT_FN = create_agent
except ImportError:
    from langgraph.prebuilt import create_react_agent
    AGENT_FN = create_react_agent

# Backend URL for tools (API_BASE_URL, PUBLISHED_URL, or PUBLIC_FILE_BASE)
def _get_base_url() -> str:
    for key in ("API_BASE_URL", "PUBLISHED_URL", "VITE_API_BASE_URL", "PUBLIC_FILE_BASE"):
        val = os.getenv(key, "").strip().rstrip("/")
        if val:
            return val
    return "http://localhost:8000"

SYSTEM_PROMPT = (
    "You are a product photography AI assistant. "
    "When the user asks for background or prompt suggestions, generate them dynamically based on the product in context. "
    "Use the image analysis (product type, brand, packaging, colors, ingredients, target audience) to suggest 3–5 tailored backdrop ideas that fit the product's identity. "
    "Examples: for food/drinks consider kitchen, farm, restaurant; for beauty consider marble, botanical, spa; for tech consider minimal, studio; for crafts consider artisan, workshop. "
    "Do NOT repeat a fixed list—always tailor suggestions to the specific product. "
    "Background removal, props, and background setting are handled by the frontend—do not offer tools for them. "
    "When the user gives a prompt and there is an image URL in context, call generate_product_image with that URL. "
    "Use tools to demonstrate each step when asked. "
    "If a tool returns an error (starts with 'Error:'), include the full error message in your response so the user can debug."
)


@tool
def upload_product_image(image_base64: str) -> str:
    """Store the uploaded product image and return its public URL. Call when user shares a product photo (base64)."""
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    data = base64.b64decode(image_base64)
    ext = ".png" if data[:8] == b"\x89PNG\r\n\x1a\n" else ".jpg"
    name = f"{uuid.uuid4().hex}{ext}"
    base = _get_base_url()
    ct = "image/jpeg" if ext == ".jpg" else "image/png"
    r = requests.post(f"{base}/upload", files={"file": (name, data, ct)}, timeout=(30, 120))
    r.raise_for_status()
    url = r.json().get("url")
    if not url:
        raise RuntimeError("Upload response missing url")
    if url.startswith("/"):
        url = f"{base}{url}"
    return url


def _local_to_public_url(image_url: str) -> str:
    """If URL is localhost, upload to temp host so KIE can fetch it."""
    if "localhost" not in image_url and "127.0.0.1" not in image_url:
        return image_url
    if "/files/" not in image_url:
        raise ValueError("Localhost image must be from /files/ path")
    filename = image_url.split("/files/")[-1].split("?")[0]
    upload_dir = Path(os.getenv("UPLOAD_DIR", "/data/uploads"))
    if not upload_dir.exists():
        upload_dir = Path("/tmp/uploads")
    filepath = upload_dir / filename
    if not filepath.exists():
        raise FileNotFoundError(f"Image not found: {filepath}")
    errors = []
    for uploader in (_upload_tmpfiles, _upload_transfer_sh, _upload_0x0, _upload_file_io):
        try:
            return uploader(filepath)
        except Exception as e:
            errors.append(f"{uploader.__name__}: {e}")
    raise RuntimeError("Could not upload image to public host. " + "; ".join(errors))


def _upload_tmpfiles(filepath: Path) -> str:
    with filepath.open("rb") as f:
        r = requests.post("https://tmpfiles.org/api/v1/upload", files={"file": (filepath.name, f)}, timeout=60)
    r.raise_for_status()
    data = r.json()
    url = data.get("data", {}).get("url") or data.get("url")
    if url:
        if "tmpfiles.org/" in url and "/dl/" not in url:
            url = url.replace("tmpfiles.org/", "tmpfiles.org/dl/")
        return url
    raise RuntimeError(str(data))


def _upload_transfer_sh(filepath: Path) -> str:
    with filepath.open("rb") as f:
        r = requests.put(f"https://transfer.sh/{filepath.name}", data=f, timeout=60)
    r.raise_for_status()
    return r.text.strip()


def _upload_0x0(filepath: Path) -> str:
    with filepath.open("rb") as f:
        r = requests.post("https://0x0.st", files={"file": (filepath.name, f)}, timeout=60)
    r.raise_for_status()
    return r.text.strip()


def _upload_file_io(filepath: Path) -> str:
    with filepath.open("rb") as f:
        r = requests.post("https://file.io", files={"file": (filepath.name, f)}, timeout=60)
    r.raise_for_status()
    data = r.json()
    url = data.get("link") or data.get("url")
    if not url:
        raise RuntimeError(str(data))
    return url


def _generate_one_image(prompt: str, kie_url: str, base: str, model: str, aspect_ratio: str) -> list[str]:
    """Generate a single image; returns list of URLs (usually 1)."""
    payload = {
        "model": model,
        "prompt": prompt,
        "image_input": [kie_url],
        "aspect_ratio": aspect_ratio,
        "resolution": "1K",
        "output_format": "png",
    }
    r = requests.post(f"{base}/generate", json=payload, timeout=60)
    r.raise_for_status()
    data = r.json()
    task_id = data.get("data", {}).get("taskId") or data.get("data", {}).get("recordId")
    if not task_id:
        raise RuntimeError("Generate response missing taskId")

    for attempt in range(40):
        s = requests.get(f"{base}/status", params={"task_id": task_id}, timeout=60)
        s.raise_for_status()
        sd = s.json().get("data", {})
        state = sd.get("state")
        if state == "success":
            rj = sd.get("resultJson") or "{}"
            try:
                urls = json.loads(rj).get("resultUrls", [])
                return urls if urls else []
            except json.JSONDecodeError:
                return []
        if state == "fail":
            raise RuntimeError(f"Generation failed: {sd}")
        time.sleep(3)
    raise TimeoutError("Generation timed out")


def _generate_product_image_impl(prompt: str, image_url: str, model: str = "nano-banana-pro") -> str:
    """Generate product photos (default 4); returns newline-separated URLs."""
    aspect_ratio = _aspect_ratio_ctx.get() or "4:3"
    num_images = _num_images_ctx.get()
    log.info("generate_product_image start prompt=%r model=%s aspect_ratio=%s num_images=%d", prompt[:60], model, aspect_ratio, num_images)
    kie_url = _local_to_public_url(image_url)
    base = _get_base_url()

    all_urls: list[str] = []
    num_images = max(1, min(num_images, 4))  # Clamp 1–4

    if num_images == 1:
        all_urls = _generate_one_image(prompt, kie_url, base, model, aspect_ratio)
    else:
        with ThreadPoolExecutor(max_workers=num_images) as executor:
            futures = [
                executor.submit(_generate_one_image, prompt, kie_url, base, model, aspect_ratio)
                for _ in range(num_images)
            ]
            for future in as_completed(futures):
                try:
                    urls = future.result()
                    all_urls.extend(urls)
                except Exception as e:
                    log.warning("One generation failed: %s", e)

    log.info("generate success total urls=%d", len(all_urls))
    return "\n".join(all_urls) if all_urls else "No result URLs."


@tool
def generate_product_image(prompt: str, image_url: str, model: str = "nano-banana-pro") -> str:
    """Generate product photography from prompt and image URL. Uses nano-banana-pro by default."""
    try:
        return _generate_product_image_impl(prompt, image_url, model)
    except Exception as e:
        log.exception("generate_product_image failed: %s", e)
        return f"Error: {e}"


def _image_url_for_vision(image_url: str) -> str:
    """If URL is localhost or /files/, read from disk (avoid self-request deadlock)."""
    if "localhost" in image_url or "127.0.0.1" in image_url:
        # Extract /files/<filename> and read from UPLOAD_DIR (same as main.py)
        if "/files/" in image_url:
            filename = image_url.split("/files/")[-1].split("?")[0]
            upload_dir = Path(os.getenv("UPLOAD_DIR", "/data/uploads"))
            if not upload_dir.exists():
                upload_dir = Path("/tmp/uploads")
            filepath = upload_dir / filename
            if filepath.exists():
                data = filepath.read_bytes()
                b64 = base64.b64encode(data).decode("ascii")
                mime = "image/jpeg" if filename.lower().endswith((".jpg", ".jpeg")) else "image/png"
                return f"data:{mime};base64,{b64}"
        # Fallback: try HTTP (may deadlock if single worker)
        r = requests.get(image_url, timeout=30)
        r.raise_for_status()
        b64 = base64.b64encode(r.content).decode("ascii")
        ct = r.headers.get("content-type", "image/jpeg")
        mime = ct.split(";")[0].strip() if ct else "image/jpeg"
        return f"data:{mime};base64,{b64}"
    return image_url


def _analyze_image(image_url: str) -> str:
    """GPT-4o vision analysis of the product image."""
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    vision_url = _image_url_for_vision(image_url)
    msg = HumanMessage(content=[
        {"type": "text", "text": (
            "Analyze this product photography image. Describe: "
            "1) What product or object is shown, 2) Current lighting and composition, "
            "3) Background/setting, 4) Suggestions for improving the shot. Be concise (3-5 sentences)."
        )},
        {"type": "image_url", "image_url": {"url": vision_url}},
    ])
    out = llm.invoke([msg])
    return out.content if hasattr(out, "content") else str(out)


_use_system = AGENT_FN.__name__ != "create_agent"
_checkpointer = MemorySaver()
_agent = None

def _get_agent():
    global _agent
    if _agent is not None:
        return _agent
    tools = [upload_product_image, generate_product_image]
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    if AGENT_FN.__name__ == "create_agent":
        _agent = AGENT_FN(llm, tools=tools, checkpointer=_checkpointer, system_prompt=SYSTEM_PROMPT)
    else:
        _agent = AGENT_FN(llm, tools, checkpointer=_checkpointer)
    return _agent


def chat_turn(message: str, thread_id: str = "default", image_url: str | None = None, model: str | None = None, aspect_ratio: str | None = None, num_images: int = 4) -> dict:
    """
    Run one agent turn. Returns { "content": str, "thumbnails": list[str] }.
    """
    _aspect_ratio_ctx.set(aspect_ratio)
    _num_images_ctx.set(num_images if num_images and 1 <= num_images <= 4 else 4)
    agent = _get_agent()
    config = {"configurable": {"thread_id": thread_id}}
    system_sent = False
    model_hint = f" Use model '{model}' for generate_product_image." if model else ""

    if image_url:
        analysis = _analyze_image(image_url)
        enriched = (
            f"[Context: User shared an image at {image_url}. Image analysis: {analysis}.{model_hint}]\n\nUser: {message}"
        )
    else:
        enriched = f"[Context:{model_hint}]\n\nUser: {message}" if model_hint else message

    msgs = []
    if _use_system and not system_sent:
        msgs.append(SystemMessage(content=SYSTEM_PROMPT))
    msgs.append(HumanMessage(content=enriched))

    result = agent.invoke({"messages": msgs}, config=config)
    last = result["messages"][-1]
    content = last.content if hasattr(last, "content") else str(last)

    # Extract thumbnails from tool responses (generate_product_image returns newline-separated URLs)
    import re
    thumbnails = []
    for msg in result["messages"]:
        cls = type(msg).__name__
        if cls == "ToolMessage":
            out = getattr(msg, "content", None) or str(msg)
            if isinstance(out, str):
                for line in out.strip().splitlines():
                    line = line.strip().rstrip(".,;")
                    if line.startswith("http://") or line.startswith("https://"):
                        thumbnails.append(line)
    if not thumbnails:
        urls = re.findall(r"https?://[^\s\)\]\"\']+", content)
        for u in urls:
            if any(x in u for x in ("tempfile", "aiquickdraw", "s3.", "amazonaws", "cloudfront", ".png", ".jpg", ".jpeg", ".webp")):
                thumbnails.append(u)
    thumbnails = list(dict.fromkeys(thumbnails))[:8]  # Dedupe, max 8
    log.info("chat_turn done thumbnails=%d", len(thumbnails))

    return {"content": content, "thumbnails": thumbnails}
