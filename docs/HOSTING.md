# Hosting Plan — Cloudflare Pages + Workers

## Architecture

```
Cloudflare Pages       ──►  SPA (static Vite bundle, CDN-served)
Cloudflare Worker      ──►  /noaa-api/*   → https://hdsc.nws.noaa.gov/
Cloudflare Worker      ──►  /contour-api/* → <Cloud Run service URL>  (when ready)
```

The two Workers are deployed alongside the Pages site and intercept matching URL prefixes — no separate infrastructure, no cold starts.

---

## Prerequisites

- Cloudflare account (free)
- GitHub repo connected to Cloudflare
- Google Maps API key (Maps, Drawing, Geometry libraries enabled)

---

## Step 1 — One-time code change: SPA routing

Cloudflare Pages needs a `_redirects` file to serve `index.html` for all routes, otherwise a page refresh on any step will 404.

Create `public/_redirects`:

```
/* /index.html 200
```

This file is copied into `dist/` automatically by Vite during build.

---

## Step 2 — Connect repo to Cloudflare Pages

1. Go to **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**
2. Select the `PeakFlow` repository
3. Configure the build:

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | `18` (set in Environment Variables as `NODE_VERSION=18`) |

4. Add environment variables (Production and Preview):

| Variable | Value |
|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | Your Maps API key |
| `VITE_CONTOUR_API_KEY` | Your contour service API key |

5. Deploy. Cloudflare builds and deploys on every push to `main`.

---

## Step 3 — NOAA Atlas 14 proxy Worker

Create a new Worker in the Cloudflare dashboard (or via Wrangler CLI) with this script:

```js
export default {
  async fetch(request) {
    const url = new URL(request.url)
    // Strip /noaa-api prefix and forward to NOAA
    url.hostname = 'hdsc.nws.noaa.gov'
    url.pathname = url.pathname.replace(/^\/noaa-api/, '')

    const response = await fetch(new Request(url.toString(), request))

    // Return response with CORS headers
    const headers = new Headers(response.headers)
    headers.set('Access-Control-Allow-Origin', '*')

    return new Response(response.body, {
      status: response.status,
      headers,
    })
  },
}
```

Bind the Worker to the Pages project:

1. Go to the Pages project → **Settings → Functions → Workers**
2. Add a route: `/noaa-api/*` → this Worker

The frontend's `atlas14Client.ts` already calls `/noaa-api/*` first, so no frontend code changes are needed.

---

## Step 4 — Contour service proxy Worker *(add when contour service is deployed)*

Once the contour service is on Cloud Run, create a second Worker:

```js
const CONTOUR_SERVICE_URL = 'https://<your-cloud-run-service>.run.app'

export default {
  async fetch(request) {
    const url = new URL(request.url)
    url.hostname = new URL(CONTOUR_SERVICE_URL).hostname
    url.protocol = 'https:'
    url.port = ''
    url.pathname = url.pathname.replace(/^\/contour-api/, '')

    return fetch(new Request(url.toString(), request))
  },
}
```

Bind it to the Pages project with route `/contour-api/*`.

`useContourService.ts` already uses `/contour-api/` paths, so again no frontend code changes are needed.

---

## Step 5 — Custom domain *(optional)*

1. Pages project → **Custom domains → Set up a custom domain**
2. Enter your domain, follow the DNS instructions
3. Cloudflare provisions a TLS cert automatically

---

## Deployment Checklist

### One-time setup
- [ ] Create `public/_redirects` with `/* /index.html 200`
- [ ] Connect repo to Cloudflare Pages
- [ ] Set build command (`npm run build`), output dir (`dist`), Node version (`18`)
- [ ] Add `VITE_GOOGLE_MAPS_API_KEY` and `VITE_CONTOUR_API_KEY` env vars
- [ ] Deploy and verify the app loads at the `*.pages.dev` URL

### NOAA proxy
- [ ] Create NOAA proxy Worker
- [ ] Bind Worker to Pages project at route `/noaa-api/*`
- [ ] Verify Atlas 14 data loads in Step 3 (Rainfall) of the deployed app

### Contour service *(when ready)*
- [ ] Deploy contour service to Cloud Run
- [ ] Create contour proxy Worker with the Cloud Run URL
- [ ] Bind Worker to Pages project at route `/contour-api/*`
- [ ] Verify contour overlay loads on the map

---

## Cost

| Service | Free tier | Expected usage |
|---|---|---|
| Cloudflare Pages | Unlimited sites, 500 builds/mo | $0 |
| Cloudflare Workers | 100,000 req/day | $0 |

Total: **$0/mo** for the frontend.
