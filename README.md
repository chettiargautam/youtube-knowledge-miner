# YouTube Knowledge Miner

<p align="center">
  <strong>Turn YouTube channels, topics, videos, and Shorts into clean AI-ready knowledge bases.</strong>
</p>

<p align="center">
  Mine useful YouTube source material into local Markdown context files you can use with Codex, Claude, ChatGPT, Cursor, Copilot, VS Code, or your own retrieval workflow.
</p>

<p align="center">
  <img alt="Local first" src="https://img.shields.io/badge/local--first-yes-111111">
  <img alt="Backend" src="https://img.shields.io/badge/backend-FastAPI-009688">
  <img alt="Frontend" src="https://img.shields.io/badge/frontend-Next.js-000000">
  <img alt="Output" src="https://img.shields.io/badge/output-Markdown-444444">
</p>

## What It Does

YouTube Knowledge Miner helps you find the right videos, select the ones that matter, and export them into a portable research corpus.

Start from:

- A YouTube channel name, handle, or URL
- A broad research topic
- Regular YouTube videos
- YouTube Shorts, when returned by search or channel Shorts URLs

Then:

- Search and rank videos by relevance
- Auto-select strong matches using keyword confidence
- Keep or change selections across pagination
- Export selected videos as one combined context file or one file per video
- Save locally or download a ready-to-use zip package

No hosted backend. No bundled LLM. No vendor lock-in. The app focuses on one thing: turning YouTube source material into files you control.

## Why This Exists

Long-form channels and topic searches can contain hundreds of hours of useful knowledge, but the material is hard to search, cite, compare, or reuse inside AI tools.

This project converts selected videos into grounded Markdown context:

- Metadata
- Descriptions
- Transcripts when available
- Comments when requested and available
- Channel/source context
- An `index.json` manifest

The resulting folder behaves like a research corpus you can open, attach, search, summarize, cite, or feed into your own RAG pipeline.

## Highlights

| Area | What You Get |
| --- | --- |
| Channel discovery | Resolve channels by URL, handle, or name, then choose the correct result. |
| Topic mining | Search YouTube by topic and choose how many results to examine. |
| Ranking | Videos are scored by title, description, tags, and query coverage. |
| Selection | Auto-selected strong matches, manual toggles, select current page, select all ranked results, and unselect all. |
| Pagination | Selection state persists across pages and export uses only the videos currently selected. |
| Export modes | Local folder export or downloadable zip package. |
| File structure | One combined context file by default, or optional file per video. |
| Progress UI | Live export progress with current thumbnail, title, count, and red-to-green progress bar. |
| Theme | Automatically follows the browser/system light or dark theme. |

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

The script handles setup and starts both services:

- Creates `backend/.env` from `backend/.env.example` when needed
- Creates `backend/.venv`
- Installs backend dependencies
- Installs frontend dependencies
- Starts the backend at `http://127.0.0.1:8000`
- Starts the frontend at `http://127.0.0.1:3000`

Open:

```text
http://127.0.0.1:3000
```

## Product Flow

### 1. Choose A Starting Point

On the home screen, choose:

- **Channel**: paste a channel URL or type an exact channel name or handle.
- **Topic**: enter a research topic and choose the number of YouTube results to inspect.

### 2. Pick The Right Channel

If the channel search returns multiple matches, compare:

- Channel name
- Handle
- Subscriber count
- Description
- Verification state
- YouTube link

Then continue to video selection.

### 3. Search, Rank, And Select Videos

In the video selector:

- Browse channel videos page by page
- Search within a selected channel
- Search and rerank topic results
- Refresh without losing the active search query
- Select visible rows, all ranked results, or clear all selections

Auto-selection is intentionally helpful, not final. You can always override it before export.

### 4. Create The Knowledge Base

Choose an export destination:

- **Local**: choose a folder and write files directly to your machine.
- **Download**: create a zip package and download it.

Choose file structure:

- **Combined context**: one Markdown file containing all selected videos. This is the default.
- **File per video**: one Markdown file per selected video.

During export, the modal locks until the job finishes. It shows:

- Current video thumbnail
- Current video title
- Completed count
- Progress bar
- Rotating extraction stage
- Skipped-video warnings if a video fails

## Output

When export finishes, the generated folder contains:

```text
your-output-folder/
└── Channel Or Topic Name/
    ├── index.json
    └── combined-context.md
```

If **File per video** is enabled:

```text
your-output-folder/
└── Channel Or Topic Name/
    ├── index.json
    ├── 001 - First Video.md
    ├── 002 - Second Video.md
    └── 003 - Third Video.md
```

Each Markdown file is written for downstream AI grounding. It includes:

- Channel name and URL
- Video title and URL
- Video ID
- Upload date
- Duration
- Views, likes, and comments when available
- Description
- Transcript when captions are available
- Comments when requested and available

Existing matching files are overwritten, so rerunning an export refreshes the knowledge base instead of creating duplicate clutter.

## Using The Output With AI Tools

This project intentionally stops at file creation. It does not ship a local LLM, prompt router, vector database, or chat UI.

Good next steps:

- Open the generated folder in VS Code and ask Copilot about the files.
- Open the folder with Codex and ask it to inspect, summarize, compare, or cite the video notes.
- Attach the generated Markdown files to Claude, ChatGPT, or another file-aware assistant.
- Build your own retrieval workflow on top of the Markdown files and `index.json`.

The exported files include explicit source framing so an AI assistant can treat them as source material from videos, not as user instructions.

## Shorts Support

The app treats Shorts as YouTube videos and can export them when they appear in results.

Supported paths:

- Topic searches that return Shorts
- Direct video metadata for short videos
- Channel Shorts URLs such as `https://www.youtube.com/@channel/shorts`

Regular channel URLs are normalized to the channel `/videos` tab. If you specifically want Shorts from a channel, use that channel's `/shorts` URL or search by topic.

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
├── backend/
│   ├── app/api/          # FastAPI routes
│   ├── app/services/     # YouTube fetching, ranking, export, folder picker
│   ├── app/schemas/      # Request and response models
│   └── requirements.txt
├── frontend/
│   ├── src/app/          # Next.js app routes and global styles
│   ├── src/components/   # Channel search, video selector, UI primitives
│   ├── src/lib/          # API client and local selection store
│   └── package.json
├── setup_and_run.py      # Cross-platform setup and local runner
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

**The browser tab icon does not refresh**

Browsers cache favicons aggressively. Hard refresh the page or clear site data if you recently changed the app icon.

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

- [FastAPI](https://fastapi.tiangolo.com/) for the local backend
- [Next.js](https://nextjs.org/) and [React](https://react.dev/) for the frontend
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for YouTube metadata extraction
- [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api) for transcript retrieval
- [RapidFuzz](https://github.com/rapidfuzz/RapidFuzz) for fast relevance scoring

Built for people who want AI answers grounded in source material they actually control.
