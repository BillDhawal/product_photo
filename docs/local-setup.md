## Local Setup Guide (Docker + Cloudflare + Frontend)

This guide runs the backend container locally, exposes it with Cloudflare Tunnel, and starts the frontend UI.

---

## 1) Backend (Docker)

### Create backend env
Create `backend/.env` (next to `backend/docker-compose.yml`):
```
KIE_API_KEY=your_key
KIE_BASE_URL=https://api.kie.ai
KIE_MODEL=flux-2/pro-image-to-image
```

### Build and run container
```
cd backend
docker compose up --build
```

Backend runs at `http://localhost:8000`.

---

## 2) Cloudflare Tunnel

Open a new terminal:
```
cloudflared tunnel --url http://localhost:8000
```

Copy the printed URL (you need this before starting the frontend):
```
https://<your-subdomain>.trycloudflare.com
```

---

## 3) Frontend (Vite)

Create or update `.env` at repo root (next to `package.json`):
```
VITE_API_BASE_URL=http://localhost:8000
VITE_PUBLIC_FILE_BASE=https://<your-subdomain>.trycloudflare.com
```

Start the frontend after setting the tunnel URL in `.env`:
```
npm run dev
```

Open the app at the URL printed by Vite (usually `http://localhost:5173`).

---

## 4) Quick Smoke Test

1) Upload a product image in the UI.
2) Send a prompt in the chatbot.
3) Thumbnails should appear and be clickable.

If you see `Invalid image format`, confirm:
- The tunnel URL is current (new tunnel = new URL).
- `VITE_PUBLIC_FILE_BASE` matches the tunnel URL.

