FROM node:22-bookworm-slim

# Install FFmpeg for video processing (Deepfake Detection) and OpenSSL for Prisma
RUN apt-get update && apt-get install -y ffmpeg openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package info
COPY package*.json ./
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Expose the API port
EXPOSE 3000

# Push db schema (create tables if missing) and start the server
CMD ["sh", "-c", "npx prisma db push && npx tsx src/index.ts"]
