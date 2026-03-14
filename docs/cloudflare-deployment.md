# Deploying PeakFlow to Cloudflare Pages

## Overview

PeakFlow is a Vite + React SPA. The static bundle deploys to **Cloudflare Pages**. Two runtime proxies that the Vite dev server handles locally must be recreated for production:

| Proxy | Dev target | Production solution |
|-------|-----------|---------------------|
| `/noaa-api/` | `https://hdsc.nws.noaa.gov/` | Cloudflare Pages Function |
| `/contour-api/` | `http://localhost:8080` | Separate host + optional Pages Function |

---

## Files to create

```
public/_redirects                  ← SPA fallback routing
functions/
  noaa-api/[[path]].ts             ← NOAA CORS proxy
  contour-api/[[path]].ts          ← Contour proxy (optional, see below)
```

---

## 1. SPA fallback routing

Create `public/_redirects`:

```
/* /index.html 200
```

This tells Cloudflare Pages to serve `index.html` for all routes, enabling client-side routing.

---

## 2. NOAA proxy — `functions/noaa-api/[[path]].ts`

```typescript
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url)
  const path = url.pathname.replace('/noaa-api', '')
  const target = `https://hdsc.nws.noaa.gov${path}${url.search}`

  const response = await fetch(target, {
    method: context.request.method,
    headers: { Accept: context.request.headers.get('Accept') ?? '*/*' },
  })

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
```

The `[[path]]` catch-all filename automatically matches all requests under `/noaa-api/**`.

---

## 3. Contour service

The contour service (`contour-service/`) is a Python application and **cannot run on Cloudflare Workers** without a full rewrite. Deploy it separately first (Fly.io, Google Cloud Run, Railway, etc.).

Once deployed, add a proxy function so the frontend requires no changes:

**`functions/contour-api/[[path]].ts`**

```typescript
export const onRequest: PagesFunction<{ CONTOUR_SERVICE_URL: string }> = async (context) => {
  const url = new URL(context.request.url)
  const path = url.pathname.replace('/contour-api', '')
  const target = `${context.env.CONTOUR_SERVICE_URL}${path}${url.search}`

  return fetch(target, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
  })
}
```

Set `CONTOUR_SERVICE_URL` as a Pages secret pointing at the deployed service URL.

---

## 4. Cloudflare Pages dashboard settings

**Pages → Create project → Connect to Git**

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | Set `NODE_VERSION=20` as an environment variable |

### Environment variables

| Variable | Description |
|----------|-------------|
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps JS API key |
| `VITE_CONTOUR_API_KEY` | Contour service API key |
| `CONTOUR_SERVICE_URL` | URL of the deployed contour service (if using the proxy function) |

---

## What you do NOT need

- `wrangler.toml` — Cloudflare Pages auto-detects Vite projects
- Any changes to `vite.config.ts` — the `server.proxy` block only applies to `npm run dev`
- Any backend — all TR-55 math is client-side TypeScript
