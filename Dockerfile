# syntax = docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app

# Install app frontend deps and build it
COPY app/package*.json ./app/
RUN cd app && npm ci

COPY app/ ./app/
RUN cd app && npm run build

# Install backend deps
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy backend source
COPY backend/ ./backend/

# Expose port
EXPOSE 3001

# Data volume mount point
VOLUME ["/data"]

WORKDIR /app/backend

CMD ["node", "index.js"]
