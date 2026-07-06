# Kinobin

A personal physical media collection tracker. Log your Blu-rays, 4K discs, DVDs, and other releases, link them to TMDB for poster art and crew info, and scan barcodes with your camera.

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/dune-shift/movie-tracker.git
cd movie-tracker
npm install
```

### 2. Set up your TMDB API key

Create a `.env` file in the project root (see `.env.example`):

```
VITE_TMDB_API_KEY=your_tmdb_api_key_here
```

Get a free API key at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).

> **Security note:** Because this is a client-side app, `VITE_*` variables are compiled into the JS bundle at build time. Your key will be visible to anyone who inspects the bundle. See [Securing your API key](#securing-your-api-key) below before deploying publicly.

### 3. Run

```bash
npm run dev
```

---

## Securing your API key

Kinobin authenticates with TMDB using a `Bearer` token header (not a query-string parameter), so your key won't appear in browser history or server request logs during normal use. However, the key is still embedded in the compiled JS bundle.

**Before deploying to a public URL:**

1. Log in to [themoviedb.org](https://www.themoviedb.org) → **Settings → API**.
2. Under your API key, find the **Allowed Domains / Referrers** field.
3. Add only the domain(s) you deploy from (e.g., `yourapp.netlify.app`).

With domain allowlisting enabled, TMDB will reject any request that doesn't originate from your approved domains — limiting the blast radius if your key is ever extracted from the bundle.

> If you run Kinobin only locally and never deploy it, domain allowlisting isn't critical. But it's a one-minute setup and worth doing.

---

## Data storage

All collection data is stored in your browser's `localStorage` under the key `kinobin-releases`. Nothing is sent to any external server.

**Storage limit:** browsers cap localStorage at ~5 MB per origin. Custom cover images are automatically compressed to a max of 800 px / 80% JPEG quality (~50–150 KB each) before being stored. If you hit the limit, you'll see an alert prompting you to remove a release with a large cover image.

> **Migrating from Fizpedia?** If you had data stored under the old `fizpedia-releases` key, Kinobin automatically migrates it to `kinobin-releases` on first load. No action required.

---

## Tech stack

- [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [React Router](https://reactrouter.com)
- [@zxing/browser](https://github.com/zxing-js/library) for barcode scanning
- [TMDB API](https://developer.themoviedb.org) for movie metadata
