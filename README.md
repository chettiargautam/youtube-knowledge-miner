# YouTube Knowledge Miner

<p align="center">
  <strong>Local-first YouTube transcript and knowledge-base miner.</strong>
</p>

<p align="center">
  Search YouTube by topic or channel, select the videos that matter, and export RAG-ready Markdown files with metadata, descriptions, comments, and transcripts when captions are available.
</p>

<p align="center">
  <a href="#quick-start"><strong>Quick Start</strong></a>
  ·
  <a href="#browser-extension">Browser Extension</a>
  ·
  <a href="#transcript-reliability">Transcript Reliability</a>
  ·
  <a href="#troubleshooting">Troubleshooting</a>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/frontend-Next.js-111111?style=for-the-badge&logo=nextdotjs&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white">
  <img alt="Extension" src="https://img.shields.io/badge/extension-MV3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white">
  <img alt="Output" src="https://img.shields.io/badge/output-Markdown-333333?style=for-the-badge&logo=markdown&logoColor=white">
</p>

![YouTube Knowledge Miner home screen](docs/images/home.png)

## What It Does

YouTube Knowledge Miner turns selected YouTube videos into clean Markdown files you can use with Codex, Claude, ChatGPT, Cursor, Copilot, VS Code, or your own retrieval pipeline.

The project is now local-first. Hosted cloud backends are commonly blocked by YouTube transcript endpoints, so the recommended workflow is to run the app on your own machine or use the included sideloaded Brave/Chrome/Edge extension with the local backend.

## Why Local First

YouTube does not provide a simple public API for arbitrary video transcripts. This app uses public caption access through `youtube-transcript-api` and `yt-dlp` fallbacks.

Running locally helps because transcript requests come from your own machine/network instead of a shared cloud IP. It does not make YouTube unlimited. If you request too many transcripts too quickly, YouTube can still temporarily rate-limit your current network/IP. The app now reports that honestly instead of handing you metadata-only files as if they were complete.

## Highlights

| Area | What You Get |
| --- | --- |
| Local-first mining | Run the backend and frontend on `127.0.0.1`; no hosted extraction required. |
| Topic search | Search YouTube by topic, rank results, and auto-select strong matches. |
| Channel workflows | Resolve channel URLs, handles, or names, then browse/search videos. |
| Bulk selection | Select visible videos, all ranked results, or individual videos. |
| Transcript checks | Export responses include transcript counts for available, blocked, and unavailable videos. |
| Honest failures | If every transcript fails, the UI reports the failure instead of auto-downloading a useless package. |
| Export formats | Create one Markdown file per video or one combined context file. |
| Browser extension | Sideload an unpaid MV3 extension for Brave, Chrome, Edge, and Chromium browsers. |

## Quick Start

### Requirements

- Python 3.10 or newer
- Node.js LTS with npm
- Internet access for YouTube metadata and caption fetching

### Run The Local App

From the repository root:

```bash
python3 setup_and_run.py
```

If your system uses `python` instead of `python3`:

```bash
python setup_and_run.py
```

The setup script:

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

Leave the terminal running while you use the app.

## Browser Extension

The `extension/` folder contains an unpacked Manifest V3 extension:

```text
extension/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
└── README.md
```

The extension is a local control panel for the backend at `http://127.0.0.1:8000`. It costs nothing to use and does not require publishing to an extension store.

### Install In Brave, Chrome, Or Edge

1. Start the local app:

   ```bash
   python3 setup_and_run.py
   ```

2. Open your browser's extension page:

   ```text
   brave://extensions
   chrome://extensions
   edge://extensions
   ```

3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select this repository's `extension` folder.
6. Open **YouTube Knowledge Miner** from the browser toolbar.

### Extension Notes

- No Chrome Web Store account is required.
- No publishing fee is required.
- No proxy subscription is required.
- The local backend must be running.
- The extension can still see transcript blocks if your current network/IP is temporarily rate-limited by YouTube.
- Safari is not targeted in the unpaid sideload flow because Safari extension distribution generally requires Apple's signing/tooling path.

## Product Flow

### 1. Choose A Source

Use either the local web app or the extension:

- **Topic**: enter a broad topic and choose how many YouTube results to inspect.
- **Channel**: paste a channel URL, handle, or exact channel name.

### 2. Select Videos

The app ranks and displays videos with useful metadata. You can keep the auto-selected videos, manually select individual videos, select all visible videos, or clear the selection.

### 3. Export The Knowledge Base

Choose:

- **File per video**: best for RAG/source-level review.
- **Combined context**: one Markdown file containing every selected video.

Choose:

- **Download**: create a zip package.
- **Local**: write files directly to a chosen folder. This is available in the local web app.

During export, the app shows progress and transcript warnings. A successful file is only useful for transcript-based context when its transcript status is `available`.

## Output

File-per-video exports look like:

```text
Channel Or Topic Name/
├── index.json
├── 001 - First Video.md
├── 002 - Second Video.md
└── 003 - Third Video.md
```

Combined exports look like:

```text
Channel Or Topic Name/
├── index.json
└── combined-context.md
```

Each Markdown file includes:

- Channel name and URL
- Video title and URL
- Video ID
- Upload date
- Duration
- Views, likes, and comments when available
- Description
- Transcript status
- Transcript text when captions are available
- Comments when requested and available

`index.json` includes a transcript summary:

```json
{
  "transcript_summary": {
    "available": 12,
    "blocked_by_youtube": 3,
    "unavailable": 1
  }
}
```

## Transcript Reliability

Transcript extraction is best-effort because YouTube caption access is unofficial and rate-limited.

The backend tries:

1. `youtube-transcript-api`
2. `yt-dlp` subtitle and automatic-caption metadata
3. readable English caption tracks when available

If YouTube blocks transcript requests from your current network/IP, the app marks those videos as blocked. This can happen locally too after too many requests. For large batches:

- Start with a small test batch.
- Prefer 10-25 videos at a time.
- Wait before retrying after blocks.
- Increase `YOUTUBE_TRANSCRIPT_DELAY_SECONDS` in `backend/.env` if you see frequent blocks.
- Avoid repeatedly exporting the same large batch while testing.

The project intentionally does not ask for your YouTube login, Google credentials, or a paid proxy account.

## Configuration

Backend settings live in `backend/.env`.

Common settings:

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
YOUTUBE_TRANSCRIPT_DELAY_SECONDS=1.0
```

If transcript requests are frequently blocked, try:

```env
YOUTUBE_TRANSCRIPT_DELAY_SECONDS=5.0
```

Then restart `setup_and_run.py`.

## Hosted Deployment

Hosted deployment is not the recommended extraction path. Cloud/serverless IPs are commonly blocked by YouTube transcript endpoints, especially when processing batches.

The repo still contains Vercel configuration because it can be useful for private previews or UI demos, but the real transcript-mining workflow is local-first.

If you deploy a private preview, treat it as best-effort and expect transcript blocks. Use the local app or sideloaded extension for real exports.

## Development

Useful checks:

```bash
python -m py_compile setup_and_run.py
cd backend && ./.venv/bin/python -m compileall app
cd frontend && npm run lint
cd frontend && npm run build
```

Run backend manually:

```bash
cd backend
PYTHONPATH=. ./.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Run frontend manually:

```bash
cd frontend
npm run dev -- --hostname 127.0.0.1 --port 3000
```

## Troubleshooting

### Extension Says Backend Offline

Start the local app first:

```bash
python3 setup_and_run.py
```

Then reload the extension popup.

### Brave/Chrome Says The Extension Manifest Is Missing

When using **Load unpacked**, select the `extension` folder itself. That folder must contain `manifest.json` directly.

### Transcript Extraction Is Blocked Locally

Your current network/IP may be temporarily rate-limited by YouTube. Wait a while, retry a smaller batch, and consider increasing:

```env
YOUTUBE_TRANSCRIPT_DELAY_SECONDS=5.0
```

Local-first reduces hosted-cloud blocking, but it does not bypass YouTube rate limits.

### Some Videos Have No Transcript

Some videos do not expose English captions, have captions disabled, are region/age restricted, or return caption tracks that cannot be read. Those files still include metadata and descriptions, but they are not full transcript context.

### Folder Picker Does Not Appear

The folder picker uses local desktop dialogs from the backend process. Make sure the backend is running on your local machine, not inside a headless remote shell.

### npm Reports Vulnerabilities

`npm install` may report dependency audit findings from the frontend dependency tree. They do not necessarily affect local use, but you can inspect them with:

```bash
cd frontend
npm audit
```

## Repository Layout

```text
.
├── backend/        # FastAPI backend and YouTube extraction services
├── frontend/       # Next.js local web app
├── extension/      # Unpacked MV3 browser extension
├── docs/images/    # README screenshots
├── setup_and_run.py
└── vercel.json     # Optional private preview deployment config
```

## Acknowledgments

YouTube Knowledge Miner builds on excellent open-source tools:

- [FastAPI](https://fastapi.tiangolo.com/) for the backend
- [Next.js](https://nextjs.org/) and [React](https://react.dev/) for the frontend
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for YouTube metadata and subtitle extraction
- [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api) for transcript retrieval
- [RapidFuzz](https://github.com/rapidfuzz/RapidFuzz) for fast relevance scoring

Built for people who want AI answers grounded in source material they actually control.
