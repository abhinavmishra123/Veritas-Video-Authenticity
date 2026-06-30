# Stage 1: Build the Vite application
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Serve the application
FROM node:22-bookworm-slim

WORKDIR /app

# Install a simple static server
RUN npm install -g serve

# Copy the built assets from the build stage
COPY --from=build /app/dist ./dist

# Expose the standard web port
EXPOSE 80

# Serve the application (SPA fallback enabled with -s)
CMD ["serve", "-s", "dist", "-l", "80"]
