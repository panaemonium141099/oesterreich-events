# ─── Stage 1: Install production dependencies ────────────────────────────────
FROM node:20-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

# Build-time public env vars (baked into the client bundle)
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

COPY package.json package-lock.json ./
RUN npm ci

# Install sharp explicitly — Next.js standalone file tracer misses it and
# image optimisation fails silently at runtime without it
RUN npm install sharp

COPY . .
RUN npm run build

# ─── Stage 3: Production runner ───────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Non-root user for security
USER node

# Copy standalone server, static assets, and public directory
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

EXPOSE 3000

# Standalone mode: start via node server.js, NOT `next start`
CMD ["node", "server.js"]
