# My Mender

My Mender is a crowdsourced map for discovering and submitting clothing menders.
It includes a public React app, PostgreSQL-backed APIs, and a private admin
workspace for reviewing submitted menders.

## Requirements

- Node.js (LTS)
- PostgreSQL
- [Atlas](https://atlasgo.io/) CLI for database migrations
- A Google Maps API key with the Maps JavaScript and Places APIs enabled

## Local setup

```sh
npm install
cp .env.example .env.local
```

Set these values in `.env.local`:

- `DATABASE_URL` — PostgreSQL connection string
- `VITE_GOOGLE_MAPS_API_KEY` — Google Maps browser key
- `VITE_GOOGLE_MAP_ID` — optional Google Cloud Map ID
- `ADMIN_INITIAL_USERNAME`, `ADMIN_INITIAL_PASSWORD`, and `ADMIN_JWT_SECRET` —
  required for the admin workspace

Apply the database migrations:

```sh
atlas migrate apply --env local
```

To create or update the first admin account, export the local environment before
running the seed script:

```sh
set -a
source .env.local
set +a
npm run seed:admin
```

## Run locally

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful routes:

- `/` or `/about` — about page
- `/map` — find active menders
- `/add` — submit a mender
- `/admin` — admin review workspace

## Other npm commands

```sh
npm run build      # create a production build in dist/
npm run preview    # preview the production build locally
npm run seed:admin # seed the admin account; DATABASE_URL must be exported
```

There is currently no `Makefile`; database and application workflows use the
Atlas and npm commands above.

## Deployment

The project is configured for Vercel through [`vercel.json`](vercel.json).
Configure the same environment variables in Vercel, including `DATABASE_URL`,
the Google Maps settings, and the admin settings. Vercel runs `npm install` and
`npm run build`, serves `dist/`, and exposes the API handlers under `/api`.
