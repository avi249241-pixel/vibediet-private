# ==============================================================================
# VibeDiet Hardened Multi-Stage Production Dockerfile (node:20-alpine)
# Multi-stage security profile: zero leak secret scanning + non-root node execution
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependency Installation, Production Build & Secret Scanning Gate
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Alpine glibc compatibility library for fast native build toolchains
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies needed for Vite & TS compilation)
RUN npm ci

# Copy full application source code and scripts
COPY . .

# Quality & Security Gate: Run production build and secret scanner
# Aborts container image creation immediately if any API key or secret pattern leaks into dist/
RUN npm run build && npm run scan

# ------------------------------------------------------------------------------
# Stage 2: Hardened Production Runtime (Non-root 'node' user)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

# Install curl for container HEALTHCHECK and libc6-compat for Alpine node extensions
RUN apk add --no-cache curl libc6-compat

WORKDIR /app

# Configure /app directory ownership for unprivileged node user
RUN chown -R node:node /app

# Switch to non-root node user (UID 1000, GID 1000)
USER node

# Production environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Install production dependencies only and tsx runtime runner
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev && npm install tsx

# Copy compiled bundles from builder stage and backend source for tsx server execution
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/src ./src
COPY --chown=node:node --from=builder /app/scripts ./scripts
COPY --chown=node:node --from=builder /app/server.ts ./server.ts

# Expose production port ($PORT defaults to 8080, overridden dynamically by Railway/PaaS)
EXPOSE 8080

# Docker Healthcheck: queries /health endpoint every 30s with 5s timeout and 3 retries
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:${PORT:-8080}/health || exit 1

# Launch production Express server via tsx
CMD ["npx", "tsx", "server.ts"]
