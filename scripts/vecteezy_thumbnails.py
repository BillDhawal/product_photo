#!/usr/bin/env python3
import json
import os
import sys
import textwrap
import webbrowser
from pathlib import Path
from urllib.parse import urlencode

import requests


API_BASE = "https://api.vecteezy.com"


def load_dotenv_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def get_env(name: str, required: bool = True) -> str | None:
    value = os.getenv(name)
    if required and not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def fetch_resources(account_id: str, api_key: str, params: dict) -> dict:
    url = f"{API_BASE}/v2/{account_id}/resources"
    headers = {"accept": "application/json", "Authorization": f"Bearer {api_key}"}
    response = requests.get(url, headers=headers, params=params, timeout=60)
    response.raise_for_status()
    return response.json()


def build_gallery_html(resources: list[dict], title: str) -> str:
    cards = []
    for item in resources:
        thumb = item.get("thumbnail_url") or item.get("thumbnail_2x_url")
        if not thumb:
            continue
        item_title = item.get("title") or "Untitled"
        item_id = item.get("id", "unknown")
        cards.append(
            f"""
            <figure class="card">
              <img src="{thumb}" alt="{item_title}">
              <figcaption>
                <div class="title">{item_title}</div>
                <div class="meta">ID: {item_id}</div>
              </figcaption>
            </figure>
            """
        )

    cards_html = "\n".join(cards) if cards else "<p>No thumbnails found.</p>"

    return textwrap.dedent(
        f"""
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>{title}</title>
          <style>
            :root {{
              color-scheme: light dark;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }}
            body {{
              margin: 24px;
            }}
            h1 {{
              margin: 0 0 16px 0;
              font-size: 20px;
            }}
            .grid {{
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
              gap: 16px;
            }}
            .card {{
              border: 1px solid #e5e7eb;
              border-radius: 12px;
              padding: 12px;
              background: #fff;
            }}
            .card img {{
              width: 100%;
              height: 160px;
              object-fit: contain;
              display: block;
              border-radius: 8px;
              background: #f3f4f6;
            }}
            .title {{
              margin-top: 8px;
              font-size: 12px;
              font-weight: 600;
            }}
            .meta {{
              font-size: 11px;
              color: #6b7280;
              margin-top: 4px;
            }}
            @media (prefers-color-scheme: dark) {{
              body {{ background: #0b0f14; color: #e5e7eb; }}
              .card {{ background: #0f172a; border-color: #1f2937; }}
              .card img {{ background: #111827; }}
              .meta {{ color: #9ca3af; }}
            }}
          </style>
        </head>
        <body>
          <h1>{title}</h1>
          <div class="grid">
            {cards_html}
          </div>
        </body>
        </html>
        """
    ).strip()


def main() -> int:
    load_dotenv_file(Path.cwd() / ".env")

    account_id = get_env("VECTEEZY_ACCOUNT_ID")
    api_key = get_env("VECTEEZY_API_KEY")

    term = os.getenv("VECTEEZY_TERM", "flower, plant")
    content_type = os.getenv("VECTEEZY_CONTENT_TYPE", "png")
    page = int(os.getenv("VECTEEZY_PAGE", "1"))
    per_page = int(os.getenv("VECTEEZY_PER_PAGE", "10"))
    sort_by = os.getenv("VECTEEZY_SORT_BY", "relevance")
    license_type = os.getenv("VECTEEZY_LICENSE_TYPE", "commercial")
    ai_generated = os.getenv("VECTEEZY_AI_GENERATED")

    params = {
        "term": term,
        "content_type": content_type,
        "page": page,
        "per_page": per_page,
        "sort_by": sort_by,
        "license_type": license_type,
    }
    if ai_generated is not None:
        params["ai_generated"] = ai_generated.lower() in {"1", "true", "yes"}

    data = fetch_resources(account_id, api_key, params)
    resources = data.get("resources", [])

    title = f"Vecteezy Thumbnails ({len(resources)} results)"
    html = build_gallery_html(resources, title)

    out_dir = Path(os.getenv("VECTEEZY_OUTPUT_DIR", "/tmp"))
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "vecteezy_thumbnails.html"
    out_file.write_text(html, encoding="utf-8")

    print("Saved gallery:", out_file)
    print("Request URL:", f"{API_BASE}/v2/{account_id}/resources?{urlencode(params)}")
    if resources:
        print("First thumbnail:", resources[0].get("thumbnail_url"))

    webbrowser.open(out_file.as_uri())
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print("Error:", exc, file=sys.stderr)
        raise SystemExit(1)
