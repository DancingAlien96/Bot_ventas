# ---- Build stage ----
FROM node:20-slim AS builder
WORKDIR /app

# Install system packages required to build native modules (better-sqlite3)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 build-essential g++ libsqlite3-dev ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy sources and build
COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy production-ready node_modules and built output from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Make a directory for the sqlite database (mounted as volume)
RUN mkdir -p /app/data
VOLUME ["/app/data"]

# Do NOT expose any ports by default (the bot uses Telegram long polling)
# If you use webhooks, expose the required port in your compose or run command.

CMD ["node", "dist/webhook.js"]
