# Media Downloader

A premium, dark-glassmorphism web app for inspecting and downloading **publicly accessible, non-DRM media** that you are authorized to download. Paste a URL, see every video and audio-only stream the source itself exposes, and download with full progress/pause/resume/cancel control.

> **Scope & compliance.** This application never attempts to bypass DRM, encryption, authentication, or any access control. It only reports and downloads streams a source has already made publicly available through its own player/API. If content is protected, geo-restricted, login-gated, or otherwise inaccessible, the app clearly tells the user it cannot be downloaded — no workaround is attempted.

---

## Features

- **Analyze any public media URL** — resolution, FPS, codecs, container, duration, thumbnail, and estimated size.
- **Every exposed stream, listed as a card** — separate sections for video streams and audio-only streams, each with a one-click download.
- **Real download manager** — live progress, speed, ETA, downloaded bytes, plus pause / resume / cancel and a completion toast.
- **Settings** — theme, default download location, preferred quality/format, notifications, language (persisted locally).
- **Honest error states** — friendly messages for invalid URLs, protected/DRM content, and "nothing downloadable" cases.
- **Premium UI** — dark glassmorphism, animated gradients, hover glow, loading skeletons, fully responsive.

---

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide Icons, React Router |
| Backend  | Node.js, Express, TypeScript, [yt-dlp](https://github.com/yt-dlp/yt-dlp) (metadata/format extraction), FFmpeg (available for optional local processing) |
| Infra    | Docker, Docker Compose, Nginx (frontend production serving + API proxy) |

### Why yt-dlp?

yt-dlp is an open-source media metadata extractor used purely to **ask a site what it already publicly exposes** — it does not decrypt DRM (Widevine/PlayReady/FairPlay), bypass logins/paywalls, or circumvent access controls. When a site protects its content, extraction fails and the backend translates that into a clear "protected" response rather than attempting any workaround.

---

## Project Structure

```
media-downloader-pro/
├── backend/
│   ├── src/
│   │   ├── config/          # env loading
│   │   ├── controllers/     # request handlers
│   │   ├── services/        # media inspection + download job manager
│   │   ├── routes/          # Express routers
│   │   ├── middleware/      # validation, error handling
│   │   ├── utils/           # logger, AppError, asyncHandler
│   │   ├── types/           # shared TypeScript types
│   │   └── index.ts         # app entrypoint
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/             # typed API client layer
│   │   ├── components/      # reusable UI components
│   │   ├── context/         # Settings / Toast / Download / Result providers
│   │   ├── hooks/           # useMediaAnalyze, useDownloadManager, useResultStore
│   │   ├── pages/           # Home, Result, Downloads, Settings
│   │   ├── types/           # shared TypeScript types
│   │   └── utils/           # formatters, validators
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── .env.example
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## Getting Started (Local Development)

### Prerequisites

- Node.js 18+
- npm 9+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp#installation) available on your `PATH` (or set `YTDLP_PATH` to its binary location)
- FFmpeg and `aria2c` available on your `PATH` for local downloads

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

The API starts on `http://localhost:4000`. Health check: `GET /api/health`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The app starts on `http://localhost:5173` and proxies `/api` to the backend automatically (see `vite.config.ts`).

Open `http://localhost:5173` in your browser.

---

## Docker

Build and run the full stack (frontend on Nginx + backend) with one command from the project root:

```bash
docker compose up --build
```

- Frontend: `http://localhost:8080`
- Backend API (direct): `http://localhost:4000/api/health`

The backend image installs `yt-dlp`, `ffmpeg`, and `aria2c` automatically during build. Media is piped directly from yt-dlp through FFmpeg to the client without server-side staging files.

To stop:

```bash
docker compose down
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | API port |
| `NODE_ENV` | `development` | Environment mode |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window |
| `RATE_LIMIT_MAX_REQUESTS` | `30` | Max requests per window per IP |
| `YTDLP_PATH` | `yt-dlp` | Path to the yt-dlp binary |
| `INSPECT_TIMEOUT_MS` | `25000` | Timeout for media inspection |
| `DOWNLOAD_MAX_CONCURRENCY` | `3` | Max simultaneous server-side downloads |
| `FFMPEG_PATH` | `ffmpeg` | Path to the FFmpeg binary |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Base path for API calls |

---

## API Reference

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/media/analyze` | `{ url }` → media metadata + streams, or a friendly error |
| `POST` | `/api/downloads` | `{ streamUrl, filename }` → creates a download job |
| `GET` | `/api/downloads` | List all download jobs |
| `GET` | `/api/downloads/:id` | Get a single job's status |
| `POST` | `/api/downloads/:id/pause` | Pause an active download |
| `POST` | `/api/downloads/:id/resume` | Resume a paused download |
| `POST` | `/api/downloads/:id/cancel` | Cancel a download |
| `GET` | `/api/downloads/:id/file` | Download the completed file |

---

## Responsible Use

- The app only lists streams that the source already exposes publicly.
- DRM-protected, encrypted, login-gated, or otherwise access-controlled media is detected and reported as **not downloadable** — the app never attempts decryption or circumvention.
- You are responsible for ensuring you have the right to download any content you fetch with this tool.

---

## Type Checking & Linting

```bash
# Backend
cd backend && npm run typecheck && npm run lint

# Frontend
cd frontend && npm run typecheck && npm run lint
```

## Production Build (without Docker)

```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm run preview
```

---

## License

This project is provided as-is for educational and personal-use purposes. Ensure your use complies with the terms of service of any source site and applicable law.
