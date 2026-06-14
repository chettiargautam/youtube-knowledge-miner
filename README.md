# YouTube Knowledge Miner

Turn a YouTube channel into a clean, local knowledge base you can use with the AI tools you already trust.

YouTube Knowledge Miner helps you find the right channel, search through its videos, select the videos that matter, and export them into a structured folder of Markdown files. Each file includes video metadata, description, transcript when available, and optional comments, so tools like Claude, Codex, Copilot, Cursor, or any local agent can ground answers in the source material.

No hosted backend. No bundled LLM. No vendor lock-in. The app focuses on the part that needs to be reliable: mining useful YouTube source material into files you control.

## Why This Exists

Long-form YouTube channels can contain hundreds or thousands of hours of useful knowledge, but the material is hard to search, cite, or reuse. This project converts selected videos into a folder that behaves like a research corpus:

- Find a channel by name, handle, or URL.
- Browse and search videos without loading an entire channel into memory.
- Select the videos worth keeping.
- Export one Markdown file per video plus an `index.json`.
- Use the generated folder with your preferred AI assistant, editor, or retrieval workflow.

## Quick Start

Prerequisites:

- Python 3.10 or newer
- Node.js LTS with npm
- Internet access for YouTube metadata and transcript fetching

From the repository root:

```bash
python setup_and_run.py
```

If your system exposes Python as `python3`:

```bash
python3 setup_and_run.py
```

The script performs the full local setup:

- Creates `backend/.env` from `backend/.env.example` when needed.
- Creates a Python virtual environment in `backend/.venv`.
- Installs backend dependencies from `backend/requirements.txt`.
- Installs frontend dependencies from `frontend/package-lock.json`.
- Starts the backend at `http://127.0.0.1:8000`.
- Starts the frontend at `http://127.0.0.1:3000`.

Open `http://127.0.0.1:3000` and start mining.

## How It Works

The app has three screens:

1. **Home**

   Search for a YouTube channel by typing a channel name, handle, or full channel URL.

   - If you paste a valid channel URL, the app validates it and takes you directly to video selection.
   - If you type a channel name, the app searches for matching channels and shows candidates sorted by subscriber count when available.

2. **Channel Results**

   Review matching channels, compare metadata, and choose the correct one.

   The channel result cards show the channel name, description, subscriber count when available, verification state when available, and a link back to YouTube for manual checking.

3. **Video Selector**

   Search and page through the selected channel’s videos, select the videos you want, and create a knowledge base.

   - Search videos by keyword.
   - Review title, thumbnail, upload date, views, and relevance score.
   - Select individual videos or select all visible videos on the current page.
   - Choose an output folder from your system file picker.
   - Create the knowledge base locally.

## Knowledge Base Output

When you create a knowledge base, the backend creates a folder named after the channel inside your chosen output directory.

The output includes:

- `index.json` with channel-level metadata and file references.
- One Markdown file per selected video.

Each Markdown file is written for downstream AI grounding. It starts with a short context note explaining that the file contains extracted YouTube video information, followed by:

- Channel name and URL
- Video title and URL
- Video ID
- Upload date
- Duration
- View count
- Like count
- Comment count when available
- Full description when available
- Transcript when YouTube captions are available
- Comments when requested and available

Existing matching files are overwritten, so rerunning an export refreshes the knowledge base instead of creating duplicate clutter.

## Using the Knowledge Base with AI Tools

This project intentionally stops at file creation. It does not ship a local LLM, prompt router, vector database, or chat UI.

That is by design: once the Markdown knowledge base exists, you can use it with whichever tool gives you the best answers.

Good next steps:

- Open the generated folder in VS Code and ask Copilot about the files.
- Open the folder with Codex and ask it to inspect, summarize, compare, or cite the video notes.
- Upload or attach the folder/files to Claude, ChatGPT, or another assistant that supports file context.
- Build your own RAG workflow on top of the generated Markdown and `index.json`.

The exported files include explicit context framing so an AI assistant can treat them as source material from videos, not as user instructions.

## Running Services Manually

The one-command setup is recommended, but you can run each service yourself.

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH="$PWD" uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

On Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:PYTHONPATH = (Get-Location).Path
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```

## Configuration

Backend configuration lives in `backend/.env`.

On first run, `setup_and_run.py` creates it from `backend/.env.example`.

Available settings:

```env
APP_NAME=youtube-channel-miner
APP_ENV=local
FRONTEND_ORIGIN=http://localhost:3000
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
DEFAULT_CHANNEL_SEARCH_LIMIT=8
VIDEO_METADATA_WORKERS=4
REQUEST_TIMEOUT_SECONDS=20
VIDEO_SEARCH_RESULT_LIMIT=500
VIDEO_SEARCH_SCAN_LIMIT=1000
```

You usually do not need to change these for local use.

## Project Structure

```text
.
├── backend/              # FastAPI API, YouTube metadata, transcripts, export logic
│   ├── app/api/          # HTTP routes
│   ├── app/services/     # Channel/video fetching, ranking, folder picking, KB creation
│   ├── app/schemas/      # Request/response models
│   └── requirements.txt
├── frontend/             # Next.js UI
│   ├── src/app/          # App routes
│   ├── src/components/   # Channel search, video selector, UI primitives
│   ├── src/lib/          # API client and local selection store
│   └── package.json
├── setup_and_run.py      # Cross-platform one-shot setup and local runner
└── README.md
```

## Troubleshooting

**`npm was not found`**

Install Node.js LTS, then run `python setup_and_run.py` again.

**Backend does not become ready**

Check that port `8000` is free, then rerun the setup script.

**Frontend port is already in use**

Stop the existing service on port `3000`, or run the frontend manually with a different port.

**A transcript is missing**

The app uses captions available through YouTube transcript access. Some videos do not expose transcripts, or may block transcript retrieval. The generated Markdown file will still include metadata and description when available.

**Folder picker does not appear**

The folder picker uses local desktop dialogs from the backend process. Make sure the backend is running on your local machine, not a headless remote shell.

## Development

Useful checks:

```bash
python -m py_compile setup_and_run.py
cd backend && ./.venv/bin/python -m compileall app
cd frontend && npm run lint
cd frontend && npm run build
```

## Acknowledgments

YouTube Knowledge Miner builds on excellent open-source tools:

- [FastAPI](https://fastapi.tiangolo.com/) for the local backend.
- [Next.js](https://nextjs.org/) and [React](https://react.dev/) for the frontend.
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for YouTube metadata extraction.
- [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api) for transcript retrieval.
- [RapidFuzz](https://github.com/rapidfuzz/RapidFuzz) for fast relevance scoring.

The project is designed to create clean, portable source material that you can bring into the AI assistant or research workflow of your choice.
