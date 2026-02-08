# === Stage 1: Install dependencies ===
FROM node:20-slim AS deps

WORKDIR /app

# Root deps
COPY package.json package-lock.json ./
RUN npm ci

# Frontend deps
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm ci

# === Stage 2: Build backend TypeScript ===
FROM deps AS build-backend

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# === Stage 3: Build frontend Vite ===
FROM deps AS build-frontend

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# === Stage 4: Production runtime ===
FROM node:20-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=build-backend /app/dist/ ./dist/
COPY --from=build-frontend /app/frontend/dist/ ./frontend/dist/

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
