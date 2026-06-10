# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* bun.lockb* ./
RUN npm install

# Vite env vars are baked in at build time — pass them as build args
ARG VITE_API_URL=http://localhost:8002
ARG VITE_REQUESTS_URL=http://localhost:8001
ARG VITE_PAYMENTS_URL=http://localhost:8003

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_REQUESTS_URL=$VITE_REQUESTS_URL
ENV VITE_PAYMENTS_URL=$VITE_PAYMENTS_URL

COPY . .
RUN npm run build

# ── Stage 2: serve ─────────────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
