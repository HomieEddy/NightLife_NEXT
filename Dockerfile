# ── deps: install node_modules + generate Prisma client ────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

# ── dev: next dev with bind-mounted source ─────────────────
#
# At runtime the compose file bind-mounts the host source to /app and
# shadows /app/node_modules with a named volume so the Linux-built
# binaries (Prisma engines, SWC) from the image survive the overlay.
FROM node:22-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY --from=deps /app/prisma ./prisma/
CMD ["npx", "next", "dev"]

# ── builder: production build (used by prod-shape profile) ─
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_APP_MODE=live
ENV NEXT_PUBLIC_APP_MODE=${NEXT_PUBLIC_APP_MODE}
RUN npx next build

# ── runner: production server ──────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ARG NEXT_PUBLIC_APP_MODE=live
ENV NEXT_PUBLIC_APP_MODE=${NEXT_PUBLIC_APP_MODE}
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/src/lib/app-mode.ts ./src/lib/app-mode.ts
# Copy the mode-specific build output
RUN --mount=from=builder,source=/app,target=/builder \
    cp -r /builder/.next-${NEXT_PUBLIC_APP_MODE} ./.next-${NEXT_PUBLIC_APP_MODE}
CMD ["npx", "next", "start"]
