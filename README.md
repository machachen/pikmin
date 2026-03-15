# Pikimin Postcard Atlas

A map-first web app for collecting Pikmin Bloom postcards. Each postcard stores:

- uploaded image
- title and description
- latitude and longitude
- auto-resolved `country`, `region`, and `city` tags

## Stack

- Next.js App Router with TypeScript
- SQLite via `better-sqlite3`
- React Leaflet + OpenStreetMap tiles
- Reverse geocoding via OpenStreetMap Nominatim

## Features

- Big interactive map on the home page
- Image-based map markers
- Right-side postcard list view
- `Add` flow for new postcard places
- Automatic reverse geocoding from lat/long into location tags
- Local image uploads stored in `public/uploads`
- SQLite database stored in `data/postcards.sqlite`

## Local setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Notes

- Clicking the map pre-fills coordinates in the add form.
- Reverse geocoding is best-effort. If the lookup fails, the postcard is still saved.
- This MVP uses local disk storage for uploads, which is ideal for development and small self-hosted deployments.
