FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first — better layer caching
COPY ./backend/package*.json ./

# Install production deps only
RUN npm install --omit=dev

# Copy backend source
COPY ./backend/ .

# Build frontend
WORKDIR /app/frontend
COPY ./frontend/package*.json ./
RUN npm install
COPY ./frontend/ .
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy backend files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./
COPY --from=builder /app/src ./src

# Copy frontend build
COPY --from=builder /app/frontend/dist ./frontend/dist

# Render sets PORT automatically; fallback for local
EXPOSE 5000

CMD ["node", "server.js"]
