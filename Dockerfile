FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_ROOT_DOMAIN
ENV NEXT_PUBLIC_ROOT_DOMAIN=$NEXT_PUBLIC_ROOT_DOMAIN
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
# Bound the build's heap. On a small VPS an unbounded Next build takes the
# whole box with it — the running app, sshd and all — and twice in this
# project's life that meant an outage lasting hours with no way in. A build
# that fails for want of memory is recoverable; a machine that stops
# answering is not. Raise this only alongside more RAM (or swap).
ENV NODE_OPTIONS=--max-old-space-size=1024
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma7.config.ts ./prisma7.config.ts
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/next.config.ts ./next.config.ts
# Runtime uploads live here (STORAGE_LOCAL_DIR); mount a volume over it or
# they vanish with the container.
RUN mkdir -p /app/storage
EXPOSE 3000
CMD ["npm", "start"]
