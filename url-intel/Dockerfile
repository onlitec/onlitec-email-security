# URL Intelligence - Dockerfile (Node.js version)
FROM node:18-alpine

LABEL maintainer="Onlitec <dev@onlitec.com>"
LABEL description="URL Intelligence for Email Security"

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./
RUN npm install --production

COPY . .

RUN chown -R node:node /app
USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["node", "server.js"]
