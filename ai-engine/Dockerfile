# AI Semantic Engine - Dockerfile (Node.js version)
# Uses cached node:18-alpine image to avoid network issues
FROM node:18-alpine

LABEL maintainer="Onlitec <dev@onlitec.com>"
LABEL description="AI Semantic Engine for Email Security"

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Create non-root user
RUN chown -R node:node /app
USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["node", "server.js"]
