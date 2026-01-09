FROM node:18-alpine AS backend-build

# Install dependencies
RUN apk add --no-cache python3 make g++ postgresql-client

WORKDIR /app

# Copy backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install --only=production

# Copy backend source
COPY backend ./backend

# Build frontend
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend ./
RUN npm run build

# Final image
FROM node:18-alpine

RUN apk add --no-cache postgresql-client curl docker-cli

WORKDIR /app

# Copy backend
# Copy backend
COPY --from=backend-build /app/backend ./backend

# Copy built frontend assets to backend/public
COPY --from=frontend-build /app/frontend/dist ./backend/public

WORKDIR /app/backend

EXPOSE 9080

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:9080/health || exit 1

CMD ["node", "server.js"]
