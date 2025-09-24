FROM node:20-alpine

# Install build tools + ffmpeg + node-pre-gyp
RUN apk add --no-cache python3 make g++ bash curl ffmpeg \
    && npm install -g npm@latest node-pre-gyp

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 4000

CMD ["node", "index.js"]
