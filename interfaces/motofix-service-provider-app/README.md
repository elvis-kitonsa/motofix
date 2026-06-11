# motofix-service-provider-app

The mechanic / service-provider dashboard for the MOTOFIX platform: receive
incoming requests, manage active jobs, navigate to drivers, handle spare parts,
and manage subscriptions.

- **Stack:** React + Vite + TypeScript
- **Production container port:** 8084

## Running locally

```bash
npm install
cp .env.example .env.local    # fill in API URLs and keys
npm run dev
```

Build for production: `npm run build`. All `VITE_`-prefixed variables are baked
into the bundle at build time — see [.env.example](.env.example).

See the [root README](../../README.md) for the full platform overview.
