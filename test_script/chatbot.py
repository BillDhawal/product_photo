"""
Product photography chatbot with LangGraph ReAct agent.
- Calls real backend APIs: /upload, /generate, /status
- Image analysis node: uses GPT-4o vision to study images before generation
- Interactive chat mode: type messages, optionally start with --image path

Loads OPENAI_API_KEY, KIE_API_KEY from backend/.env. Run from project root or test_script.
"""
import argparse
import base64
import os
import sys
import uuid
import warnings
from pathlib import Path

warnings.filterwarnings("ignore", category=UserWarning, module="langchain_core")
warnings.filterwarnings("ignore", message=".*create_react_agent.*")

# Load .env from backend folder
backend_env = Path(__file__).resolve().parents[1] / "backend" / ".env"
if backend_env.exists():
    from dotenv import load_dotenv
    load_dotenv(backend_env)
else:
    print("Warning: backend/.env not found. Set OPENAI_API_KEY and BACKEND_URL manually.")

if not os.getenv("OPENAI_API_KEY"):
    print("Error: OPENAI_API_KEY not set. Add it to backend/.env")
    sys.exit(1)

from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver

try:
    from langchain.agents import create_agent
    AGENT_FN = create_agent
except ImportError:
    from langgraph.prebuilt import create_react_agent
    AGENT_FN = create_react_agent

from api_client import get_backend_url, upload_image, create_generate_task, poll_status

SYSTEM_PROMPT = (
    "You are a product photography AI assistant. "
    "When the user asks for help, suggest prompts like: Soft morning light, Minimal shadow play, Spa marble backdrop, Botanical studio set. "
    "Background removal, props, and background setting are handled by the frontend—do not offer tools for them. "
    "When the user gives a prompt and there is an image URL in context, call generate_product_image with that URL. "
    "Use tools to demonstrate each step when asked."
)


# --- Tools (call real backend APIs) ---

@tool
def upload_product_image(image_base64: str) -> str:
    """Store the uploaded product image and return its public URL. Call this when the user uploads or shares a product photo (base64-encoded)."""
    import requests
    # Strip data URL prefix if present
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    data = base64.b64decode(image_base64)
    ext = ".png" if data[:8] == b"\x89PNG\r\n\x1a\n" else ".jpg"
    name = f"{uuid.uuid4().hex}{ext}"
    base = get_backend_url()
    response = requests.post(
        f"{base}/upload",
        files={"file": (name, data, f"image/{ext[1:]}" if ext == ".jpg" else "image/png")},
        timeout=(30, 120),
    )
    response.raise_for_status()
    payload = response.json()
    url = payload.get("url")
    if not url:
        raise RuntimeError(f"Upload response missing url: {payload}")
    if url.startswith("/"):
        url = f"{base}{url}"
    return url


@tool
def generate_product_image(prompt: str, image_url: str, model: str = "nano-banana-pro") -> str:
    """Generate final product photography using the prompt and image URL. Uses nano-banana-pro by default. Calls backend API, polls until done, returns result image URLs."""
    task_id = create_generate_task(
        input_url=image_url,
        prompt=prompt,
        model=model,
        aspect_ratio="4:3",
        resolution="1K",
    )
    urls = poll_status(task_id)
    return "\n".join(urls) if urls else "No result URLs returned."


# --- Image analysis (LangGraph-style preprocessing) ---

def analyze_image_with_vision(image_url: str) -> str:
    """Use GPT-4o vision to analyze the product image. Returns a description for the agent."""
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    human_msg = HumanMessage(content=[
        {"type": "text", "text": (
            "Analyze this product photography image. Describe: "
            "1) What product or object is shown, 2) Current lighting and composition, "
            "3) Background/setting, 4) Suggestions for improving the shot (e.g. better backdrop, props). "
            "Be concise (3-5 sentences)."
        )},
        {"type": "image_url", "image_url": {"url": image_url}},
    ])
    msg = llm.invoke([human_msg])
    return msg.content if hasattr(msg, "content") else str(msg)


# --- Agent setup ---

tools = [upload_product_image, generate_product_image]
llm = ChatOpenAI(model="gpt-4o", temperature=0)
checkpointer = MemorySaver()
if AGENT_FN.__name__ == "create_agent":
    agent = AGENT_FN(llm, tools=tools, checkpointer=checkpointer, system_prompt=SYSTEM_PROMPT)
else:
    agent = AGENT_FN(llm, tools, checkpointer=checkpointer)

config = {"configurable": {"thread_id": "test_session_1"}}
_system_sent = False
_use_system_in_messages = AGENT_FN.__name__ != "create_agent"

# Shared state: current image URL (from --image or previous upload)
_current_image_url: str | None = None


def run_turn(message: str, image_path: Path | None = None) -> dict:
    """Run one agent turn. If image_path given, upload + analyze first, then inject context."""
    global _system_sent, _current_image_url

    if image_path and image_path.exists():
        print("  Uploading image...")
        _current_image_url = upload_image(image_path)
        print(f"  Uploaded: {_current_image_url}")
        print("  Analyzing image...")
        analysis = analyze_image_with_vision(_current_image_url)
        print(f"  Analysis: {analysis[:200]}...")
        enriched = (
            f"[Context: User shared an image at {_current_image_url}. "
            f"Image analysis: {analysis}.]\n\nUser: {message}"
        )
    elif _current_image_url:
        enriched = f"[Context: Current image URL: {_current_image_url}]\n\nUser: {message}"
    else:
        enriched = message

    msgs = []
    if _use_system_in_messages and not _system_sent:
        msgs.append(SystemMessage(content=SYSTEM_PROMPT))
        _system_sent = True
    msgs.append(HumanMessage(content=enriched))

    result = agent.invoke({"messages": msgs}, config=config)
    last_msg = result["messages"][-1]
    return {"content": last_msg.content, "result": result}


def extract_urls_from_response(content: str) -> list[str]:
    """Extract http(s) URLs from assistant response for thumbnail display."""
    import re
    return re.findall(r"https?://[^\s\)\]\"]+", content)


def interactive_chat(image_path: Path | None = None):
    """Interactive chat loop. Shows assistant replies and result URLs."""
    global _current_image_url
    if image_path and image_path.exists():
        print("Uploading and analyzing image...")
        _current_image_url = upload_image(image_path)
        analysis = analyze_image_with_vision(_current_image_url)
        print(f"Image analysis: {analysis}\n")
    else:
        _current_image_url = None

    print("Product Photography Chatbot (backend APIs)")
    print("Backend:", get_backend_url())
    print("Commands: /quit, /image <path>")
    print("-" * 50)

    while True:
        try:
            user_input = input("\nYou: ").strip()
        except EOFError:
            break
        if not user_input:
            continue
        if user_input.lower() == "/quit":
            break
        if user_input.lower().startswith("/image "):
            path = Path(user_input[7:].strip()).expanduser()
            if path.exists():
                print("  Uploading...")
                _current_image_url = upload_image(path)
                print(f"  Image URL: {_current_image_url}")
            else:
                print("  File not found.")
            continue

        print("\nAssistant: ", end="", flush=True)
        out = run_turn(user_input)
        print(out["content"])

        urls = extract_urls_from_response(out["content"])
        if urls:
            print("\n  Result thumbnails:")
            for u in urls[:4]:
                print(f"    {u}")


def run_tests():
    """Run predefined tests against real backend."""
    test_image = Path(__file__).resolve().parents[1] / "src/assets/test_assets/product-photo-standard-9-16.jpg"
    if not test_image.exists():
        print("Test image not found:", test_image)
        print("Skipping tests that require image.")
        test_image = None

    print("LangGraph ReAct Agent - Real API Tests")
    print("Backend:", get_backend_url())
    print("-" * 60)

    def turn(msg: str, img: Path | None = None):
        print(f"\nUSER: {msg}")
        out = run_turn(msg, image_path=img)
        print(f"\nASSISTANT: {out['content']}")
        urls = extract_urls_from_response(out["content"])
        if urls:
            print("  Thumbnails:", urls[:4])

    turn("What background ideas can you suggest for my product photo?")

    if test_image:
        turn("Generate a minimal shadow play background.", img=test_image)
        turn("Generate the final product image with prompt 'luxury marble spa'.")
    else:
        turn("Generate with prompt 'luxury marble spa' using image https://example.com/product.png")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Product photography chatbot")
    parser.add_argument("--image", "-i", type=Path, help="Path to product image to start with")
    parser.add_argument("--test", "-t", action="store_true", help="Run predefined tests instead of interactive chat")
    args = parser.parse_args()

    if args.test:
        run_tests()
    else:
        interactive_chat(image_path=args.image)
