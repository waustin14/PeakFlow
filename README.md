# PeakFlow

A frontend-only React/TypeScript SPA for hydrological engineering analysis using the **USDA TR-55** methodology. PeakFlow guides users through a six-step workflow to compute peak discharge, runoff volume, and detention basin sizing for small urban watersheds.

## Features

- **Interactive watershed delineation** — draw a polygon directly on Google Maps
- **Automated rainfall data** — fetches 24-hour precipitation depths from [NOAA Atlas 14](https://hdsc.nws.noaa.gov/) for any US location
- **TR-55 computation engine** — pure TypeScript implementation of runoff volume (Module 1), peak discharge (Module 3), and detention basin sizing (Module 4)
- **Time of concentration** — supports sheet flow, shallow-concentrated flow, and channel flow segments
- **Synthetic hydrograph** — SCS triangular approximation rendered with Recharts
- **Contour overlay** — optional LiDAR-derived contour tiles rendered on the map via an external microservice
- **PDF & JSON export** — generate a formatted report or export raw project data
- **Dark/light mode** — class-based theme toggle, persisted to `localStorage`

## Prerequisites

- **Node.js** 18+
- A **Google Maps JavaScript API** key with the Maps, Drawing, and Geometry libraries enabled

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and set VITE_GOOGLE_MAPS_API_KEY

# 3. Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | Yes | Google Maps JavaScript API key |
| `VITE_CONTOUR_API_KEY` | No | API key for the contour service (defaults to `dev-key`) |

## Commands

```bash
npm run dev      # Start Vite dev server with HMR
npm run build    # Type-check then produce production bundle
npm run lint     # Run ESLint
npm run preview  # Serve the production build locally
```

## Workflow

The app guides users through six sequential steps:

| Step | Description |
|------|-------------|
| 1 | **Project Setup** — project name and return period selection (1, 2, 5, 10, 25, 50, 100-yr) |
| 2 | **Watershed** — draw watershed polygon on Google Maps; area computed automatically |
| 3 | **Rainfall** — fetch NOAA Atlas 14 24-hr depths for the watershed centroid, or enter manually |
| 4 | **Land Use & Soils** — add land use entries with hydrologic soil group (A–D) and curve numbers |
| 5 | **Time of Concentration** — add sheet, shallow-concentrated, and channel flow segments |
| 6 | **Results** — compute and display peak discharge, runoff volumes, detention sizing, and hydrograph |

## Project Structure

```
src/
├── components/
│   ├── layout/        # AppShell, Sidebar, StepNav
│   ├── map/           # WatershedMap, PolygonLayer, DrawingControls, ContourOverlay
│   ├── steps/         # Step1–Step6 panels
│   ├── shared/        # InfoTooltip, ErrorBanner, LoadingSpinner, ValueWithUnit
│   └── ui/            # Radix UI primitives (Button, Input, Select, …)
├── data/              # Static lookup tables (cnTable, unitPeakDischarge, constants)
├── hooks/             # useTR55Results, useNoaaData, useCompositeCN, useMapInstance, useContourService
├── lib/
│   ├── tr55/          # Pure TS math: runoffVolume, peakDischarge, timeOfConcentration, detentionBasin
│   ├── geo/           # polygonArea, centroid
│   ├── noaa/          # Atlas 14 HTTP client and response parser
│   └── export/        # PDF (html2canvas + jspdf) and JSON export
├── store/
│   ├── useProjectStore.ts  # All project data, persisted to localStorage
│   └── useUIStore.ts       # Ephemeral UI state (active step, drawing mode, contour status)
└── types/             # project.ts, tr55.ts, noaa.ts, results.ts
```

## Architecture

PeakFlow has no backend. All computation runs in the browser:

- **State** — two [Zustand](https://github.com/pmndrs/zustand) stores using Immer middleware. `useProjectStore` holds watershed geometry, rainfall depths, land use entries, flow segments, and computed results (persisted to `localStorage`). `useUIStore` holds ephemeral UI state.
- **Rainfall data** — fetched from the NOAA Atlas 14 JSON API via a Vite dev-proxy (`/noaa-api/` → `https://hdsc.nws.noaa.gov/`). In production, configure your own reverse proxy or CORS-enabled endpoint.
- **TR-55 engine** — pure functions in `src/lib/tr55/` with no side effects, driven reactively by `useTR55Results`.
- **Path alias** — `@/` maps to `src/`.

## Contour Service (Optional)

The watershed map can display LiDAR-derived contour lines from a companion microservice located in `contour-service/`. It is a Python FastAPI + Celery service that generates map tile overlays on demand.

```bash
cd contour-service
cp .env.example .env
make up       # starts API, worker, Postgres, Redis, and MinIO via Docker Compose
```

The service will be available at `http://localhost:8080`. The Vite dev server proxies `/contour-api/` to it automatically.

See [`contour-service/docs/API.md`](contour-service/docs/API.md) and [`contour-service/docs/DEPLOYMENT.md`](contour-service/docs/DEPLOYMENT.md) for full documentation.

## Reference

- USDA, *Urban Hydrology for Small Watersheds*, TR-55 (2nd ed., 1986)
- NOAA Atlas 14, *Precipitation-Frequency Atlas of the United States*
