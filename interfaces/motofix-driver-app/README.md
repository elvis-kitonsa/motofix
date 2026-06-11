# motofix-driver-app

The driver-facing app for the MOTOFIX platform: request roadside assistance,
track providers, find fuel stations and spare-parts dealers, get maintenance
reminders, and chat with the MOTOBOT AI assistant.

- **Stack:** React + Vite + TypeScript
- **Production container port:** 8083

## Running locally

```bash
npm install
cp .env.example .env.local    # fill in API URLs and keys
npm run dev
```

Build for production: `npm run build`. All `VITE_`-prefixed variables are baked
into the bundle at build time — see [.env.example](.env.example).

See the [root README](../../README.md) for the full platform overview.
