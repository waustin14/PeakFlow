# Deploying PeakFlow to Firebase Hosting

## Overview

PeakFlow is a Vite + React SPA. Deploy the static bundle to **Firebase Hosting** and recreate local dev proxies in production using Hosting rewrites:

| Proxy | Dev target | Firebase production solution |
|-------|------------|------------------------------|
| `/contour-api/` | `http://localhost:8080` | Hosting rewrite to Cloud Run `contour-api` |
| `/noaa-api/` | `https://hdsc.nws.noaa.gov/` | Optional Hosting rewrite to a NOAA proxy service |

`/noaa-api` is optional because the app already falls back to direct NOAA calls if proxying fails.

---

## Prerequisites

- Google Cloud project with billing enabled
- Firebase project linked to the same GCP project
- Deployed Cloud Run contour API service (for example, `contour-api`)
- Node.js 20+

Install tools:

```bash
npm install
npm install -g firebase-tools
firebase login
```

---

## 1. Build the app

```bash
npm run build
```

Output is generated in `dist/`.

---

## 2. Initialize Firebase Hosting

From repo root:

```bash
firebase init hosting
```

Choose:
- Existing project: your Firebase/GCP project
- Public directory: `dist`
- Single-page app rewrite: `No` (we define explicit rewrites in `firebase.json`)
- GitHub Action setup: optional

This creates:
- `.firebaserc`
- `firebase.json`

---

## 3. Configure Hosting rewrites

Update `firebase.json`:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "headers": [
      {
        "source": "**/*.@(js|css|svg|png|jpg|jpeg|webp|woff2)",
        "headers": [
          { "key": "Cache-Control", "value": "public,max-age=31536000,immutable" }
        ]
      }
    ],
    "rewrites": [
      {
        "source": "/contour-api/**",
        "run": {
          "serviceId": "contour-api",
          "region": "us-central1"
        }
      },
      {
        "source": "/noaa-api/**",
        "run": {
          "serviceId": "noaa-proxy",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

Notes:
- If you do not deploy a `noaa-proxy` service, remove the `/noaa-api/**` rewrite.
- Keep the SPA fallback rewrite (`"source": "**"`).
- If your Cloud Run region differs, change `"region"` accordingly.

---

## 4. Environment variables for build

Set frontend build-time values before `npm run build`:

```bash
export VITE_GOOGLE_MAPS_API_KEY="..."
export VITE_CONTOUR_API_KEY="..."
npm run build
```

Because calls are path-based (`/contour-api/...`) in app code, no additional frontend API base URL is required.

---

## 5. Deploy

```bash
firebase deploy --only hosting
```

After deploy, test:
- App loads and client-side routes refresh correctly
- `POST /contour-api/v1/contours/jobs` succeeds via Hosting rewrite
- Tile URLs under `/contour-api/v1/contours/tiles/...` load on the map
- NOAA requests work via `/noaa-api` or direct fallback

---

## 6. Recommended production hardening

1. Cloud Run ingress/auth
- Keep `contour-api` public if needed by Hosting rewrite.
- Restrict with API key checks already in service and add Cloud Armor rate limiting if traffic grows.

2. CDN/caching
- Keep immutable cache headers for built static assets.
- For contour tiles, prefer long-lived caching headers at the contour service and/or CDN layer.

3. Release process
- Deploy to a preview channel first:
  ```bash
  firebase hosting:channel:deploy preview
  ```
- Promote to live after verification.

---

## Optional: GitHub Actions deployment

If you want CI deploys, add a workflow that:
1. Installs dependencies
2. Builds with `VITE_*` secrets
3. Runs `firebase deploy --only hosting`

Use a Firebase CI token or workload identity federation for credentials.

---

## What you do NOT need

- Changes to `vite.config.ts` for production proxying (dev proxy is local-only)
- A Node/SSR runtime for this frontend (it is a static SPA)
- Any code change for `/contour-api` routing if Hosting rewrites are configured
