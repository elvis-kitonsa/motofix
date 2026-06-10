# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* bun.lockb* ./
RUN npm install

# Vite env vars are baked in at build time — pass them as build args
ARG VITE_API_AUTH_URL=http://localhost:8000
ARG VITE_API_MECHANICS_URL=http://localhost:8002
ARG VITE_API_REQUESTS_URL=http://localhost:8001
ARG VITE_WS_URL=ws://localhost:8001/ws/jobs
ARG VITE_API_DIAGNOSIS_URL=http://localhost:8007
ARG VITE_GOOGLE_MAPS_API_KEY=

ENV VITE_API_AUTH_URL=$VITE_API_AUTH_URL
ENV VITE_API_MECHANICS_URL=$VITE_API_MECHANICS_URL
ENV VITE_API_REQUESTS_URL=$VITE_API_REQUESTS_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_API_DIAGNOSIS_URL=$VITE_API_DIAGNOSIS_URL
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

COPY . .
RUN npm run build

# ── Stage 2: serve ─────────────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
