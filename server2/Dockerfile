# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps
RUN npm install -g typescript

# Copy all source files
COPY . .


RUN npm run build

# Stage 2: Run
FROM node:20-alpine AS runner
WORKDIR /app

# Copy only the build output and dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist   

# Expose your port
EXPOSE 4000

# Start the compiled app
CMD ["node", "dist/index.js"]
