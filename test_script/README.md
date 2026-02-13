# Chatbot: Product Photography AI Assistant

A standalone LangGraph ReAct agent that assists users with product photography. The agent **calls real backend APIs** (`/upload`, `/generate`, `/status`), uses **GPT-4o vision to analyze images** before generation, and supports **interactive chat** with thumbnail results.

**Background removal, props, and background setting are handled by the frontend**—the chatbot does not expose tools for them.

---

## Overview

The chatbot is a **ReAct (Reasoning + Acting) agent** that:

1. Receives user messages (optionally with an image)
2. **Analyzes images** with GPT-4o vision when provided
3. Reasons about which tools to call
4. Calls **real backend APIs** (upload, generate, poll)
5. Returns natural language responses with result URLs

---

## How It Works

### Architecture

```
User Message (+ optional image)
    → Upload image (if path given) → Vision analysis
    → Agent (ReAct) → LLM decides → Tool calls (upload_product_image, generate_product_image)
    → Backend /upload, /generate, /status
    → Poll until success → Return result URLs
    → MemorySaver (conversation history)
```

### Flow

1. **Message + image** – User provides message and optionally an image path (`--image` or `/image path`).
2. **Upload** – Image is uploaded to backend `/upload`, returns public URL.
3. **Image analysis** – GPT-4o vision analyzes the image (product, lighting, composition, suggestions).
4. **Agent invokes** – Enriched context (image URL + analysis + message) is sent to the agent.
5. **Tool execution** – Agent calls `generate_product_image` → backend `/generate` → poll `/status` until done.
6. **Response** – Agent returns result URLs; script displays thumbnails.

### System Prompt

The agent is instructed to:

- Suggest background ideas (Soft morning light, Minimal shadow play, Spa marble backdrop, Botanical studio set) when asked for help
- Not offer background removal, props, or background setting—handled by the frontend
- Call `generate_product_image` when the user gives a prompt and there is an image URL in context

---

## Tools (Real Backend APIs)

### 1. `upload_product_image`

| Field | Value |
|-------|-------|
| **Purpose** | Store uploaded product image and return public URL |
| **When to call** | User uploads or shares a product photo (base64) |
| **Parameters** | `image_base64: str` – Base64-encoded image |
| **Implementation** | POST to backend `/upload`, returns `url` |

### 2. `generate_product_image`

| Field | Value |
|-------|-------|
| **Purpose** | Generate product photography from prompt + image URL |
| **When to call** | User gives a prompt and there is an image in context |
| **Parameters** | `prompt: str`, `image_url: str`, `model: str = "nano-banana-pro"` |
| **Implementation** | POST `/generate` → poll `GET /status?task_id=...` until `state == "success"` → parse `resultJson.resultUrls` |

---

## Image Analysis Node

Before the agent runs, when an image is provided:

1. Image is uploaded to get a URL.
2. **Vision analysis** – GPT-4o analyzes the image and returns:
   - Product/object type
   - Current lighting and composition
   - Background/setting
   - Suggestions for improving the shot

This analysis is injected into the agent context so it can make better generation decisions.

---

## Requirements & Dependencies

| Package | Purpose |
|---------|---------|
| `langgraph` | ReAct agent, graph execution |
| `langchain` | `create_agent` (if available) |
| `langchain-openai` | `ChatOpenAI` (GPT-4o), vision |
| `langchain-core` | `@tool`, messages |
| `python-dotenv` | Load `backend/.env` |
| `requests` | Backend API calls |

---

## Environment

- **Config**: `backend/.env`
- **Required**: `OPENAI_API_KEY` (LLM + vision)
- **Backend**: `BACKEND_URL` or `API_BASE_URL` or `VITE_API_BASE_URL` from `backend/.env` (default: `http://localhost:8000`)
- **Generate API**: Backend must have `KIE_API_KEY` configured for `/generate` and `/status`

**Note:** The KIE generate API fetches the image from the upload URL. Use a deployed backend (e.g. `API_BASE_URL` in `.env`) so the image URL is publicly accessible. `localhost` upload URLs will not work for generation.

---

## Running

### Setup

```bash
cd test_script
pip install -r requirements.txt
```

Ensure `OPENAI_API_KEY` and `KIE_API_KEY` are in `backend/.env`. Set `API_BASE_URL` or `BACKEND_URL` to your backend (e.g. deployed API URL for KIE to fetch images).

### Interactive Chat

```bash
python chatbot.py
```

Or with an image to start:

```bash
python chatbot.py --image ../src/assets/test_assets/product-photo-standard-9-16.jpg
```

**Commands:**
- `/quit` – Exit
- `/image <path>` – Upload and set a new image

### Run Tests (Real API)

```bash
python chatbot.py --test
```

Runs predefined messages against the real backend, including:
1. Suggest background ideas (no tools)
2. Generate with test image (upload → analyze → generate → poll → thumbnails)
3. Generate again with "luxury marble spa" (uses image from context)

---

## Test Image

Use `src/assets/test_assets/product-photo-standard-9-16.jpg`:

```bash
python chatbot.py -i src/assets/test_assets/product-photo-standard-9-16.jpg
```

---

## Adding or Removing Tools

### Adding a Tool

1. Define `@tool` in `chatbot.py`.
2. Add to `tools` list.
3. Update `SYSTEM_PROMPT` if needed.

### Removing a Tool

1. Remove the `@tool` function.
2. Remove from `tools` list.
3. Remove references in `SYSTEM_PROMPT`.

---

## Next Steps (Integration)

1. **Backend**: Add `/chat` endpoint; wire agent to FastAPI.
2. **Frontend**: Point `AIChatbot` at `/chat` instead of direct upload/generate.
3. **Streaming**: Stream agent steps and tool results to the UI.
4. **Persistence**: Replace `MemorySaver` with a database-backed checkpointer.
