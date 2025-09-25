# # Stage 1: Build
# FROM node:20-alpine AS builder
# WORKDIR /app

# # Install dependencies
# COPY package*.json ./
# RUN npm install --legacy-peer-deps
# RUN npm install -g typescript

# # Copy all source files
# COPY . .


# RUN npm run build

# # Stage 2: Run
# FROM node:20-alpine AS runner
# WORKDIR /app

# # Copy only the build output and dependencies
# COPY --from=builder /app/package*.json ./
# COPY --from=builder /app/node_modules ./node_modules
# COPY --from=builder /app/dist ./dist   

# # Expose your port
# EXPOSE 4000

# # Start the compiled app
# CMD ["node", "dist/index.js"]
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --legacy-peer-deps
RUN npm install -g typescript
RUN npm install @prisma/client
# Generate Prisma client
RUN npx prisma generate

# Copy all source files
COPY . .

# Build TypeScript
RUN npm run build


# Stage 2: Run
FROM node:20-alpine AS runner
WORKDIR /app

# Copy only production deps + prisma client
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
RUN npm install --omit=dev --legacy-peer-deps

# Copy compiled app
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 4000

# Start the compiled app
CMD ["node", "dist/index.js"]
