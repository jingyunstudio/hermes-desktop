FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/hermes-config-ui ./packages/hermes-config-ui

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --filter @hermes-desktop/config-ui

# Build
WORKDIR /app/packages/hermes-config-ui
RUN pnpm build

FROM node:20-alpine

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY --from=builder /app/packages/hermes-config-ui/package.json ./

# Install production dependencies
RUN pnpm install --prod

# Manually rebuild better-sqlite3 with native bindings
RUN cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 && npm run build-release

# Copy built files
COPY --from=builder /app/packages/hermes-config-ui/dist ./dist

# Install docker CLI for container operations
RUN apk add --no-cache docker-cli

EXPOSE 3005

ENV NODE_ENV=production
ENV HERMES_CONFIG_DIR=/hermes-config
ENV OPENWEBUI_DB=/webui-data/webui.db
ENV HERMES_CONTAINER=hermes-desktop-runtime
ENV WEBUI_CONTAINER=hermes-desktop-webui

CMD ["node", "dist/server.js"]
