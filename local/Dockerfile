FROM node:20-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./
COPY local/package.json ./local/

# Install dependencies
RUN npm ci

# Copy source
COPY src ./src
COPY tsconfig.json ./
COPY local ./local

EXPOSE 3000 3001 3002 3003 3004

CMD ["npx", "tsx", "local/server.ts"]
