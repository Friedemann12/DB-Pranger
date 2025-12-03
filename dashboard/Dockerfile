# DB Pranger Dashboard - Dockerfile
# Pure Bun Alpine build

# ============================================================================
# Stage 1: Dependencies
# ============================================================================
FROM oven/bun:1-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* package-lock.json* ./

# Install dependencies + native binaries for Alpine (musl)
RUN bun install && \
    bun add lightningcss-linux-x64-musl @tailwindcss/oxide-linux-x64-musl

# ============================================================================
# Stage 2: Builder
# ============================================================================
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables (ARG for build-time, ENV for runtime)
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN bun run build

# ============================================================================
# Stage 3: Production Runner
# ============================================================================
FROM oven/bun:1-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 bunjs && \
    adduser --system --uid 1001 --ingroup bunjs nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Set correct permissions for prerender cache
RUN mkdir .next && chown nextjs:bunjs .next

# Copy built application
COPY --from=builder --chown=nextjs:bunjs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Start with Bun
CMD ["bun", "run", "start"]
