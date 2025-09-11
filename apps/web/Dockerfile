# Use Node.js 20 Alpine as base image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@latest

# Copy workspace configuration files
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./

# Copy package.json files for workspace packages that web depends on
COPY packages/analytics/package.json ./packages/analytics/
COPY packages/shared/package.json ./packages/shared/
COPY packages/types/package.json ./packages/types/

# Copy the web app package.json
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@latest

# Copy workspace files and installed dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json ./

# Accept build arguments for Supabase environment variables
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Set environment variables for build time
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Copy source code for workspace packages
COPY packages/analytics ./packages/analytics
COPY packages/shared ./packages/shared  
COPY packages/types ./packages/types

# Copy web app source
COPY apps/web ./apps/web

# Build workspace packages first
RUN pnpm --filter "@nexus/analytics" build
RUN pnpm --filter "@nexus/shared" build
RUN pnpm --filter "@nexus/types" build

# Build the web application
RUN pnpm --filter "web" build

# Verify build outputs exist (fail fast if standalone or CSS missing)
RUN [ -d /app/apps/web/.next/standalone ] || (echo "ERROR: Missing standalone output" && exit 1)
RUN [ -d /app/apps/web/.next/static ] || (echo "ERROR: Missing static output" && exit 1)

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Create nextjs user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Copy static assets and public folder with correct monorepo paths
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Set the correct permission for prerender cache
RUN mkdir -p .next apps/web/.next
RUN chown -R nextjs:nodejs .next apps/web/.next

# Verify static assets are in correct location (fail fast if missing)
RUN [ -d apps/web/.next/static ] || (echo "ERROR: Static assets not found at expected location" && exit 1)
RUN [ -d apps/web/public ] || (echo "ERROR: Public assets not found at expected location" && exit 1)

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "apps/web/server.js"]
