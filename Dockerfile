FROM node:20-alpine AS base

# -- Build stage --
FROM base AS builder
WORKDIR /app

ARG NEXT_PUBLIC_BASE_PATH=/5mouse
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# -- Runtime stage --
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ARG NEXT_PUBLIC_BASE_PATH=/5mouse
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}

# Install git (needed for simple-git operations)
RUN apk add --no-cache git

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code@latest 2>/dev/null || echo "WARN: claude-code install failed, agent features require ANTHROPIC_API_KEY"

COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create data directory
RUN mkdir -p /data/projects

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx server.ts"]
