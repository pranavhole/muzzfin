# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code and build
COPY . .
RUN npm run build

# --- Production stage ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next

# Ensure public folder exists (optional copy)
# Ensure public folder exists (optional copy)
# Build stage
RUN mkdir -p /app/public

COPY --from=builder /app/public/ ./public/


EXPOSE 3000
CMD ["npm", "start"]
