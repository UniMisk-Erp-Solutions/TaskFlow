FROM node:18-alpine

WORKDIR /app

# Copy package files first — better layer caching
COPY ./backend/package*.json ./

# Install production deps only
RUN npm install --omit=dev

# Copy source
COPY ./backend/ .

# Render sets PORT automatically; fallback for local
EXPOSE 5000

CMD ["node", "server.js"]
