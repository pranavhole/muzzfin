FROM node:20-alpine

# Install deps (yt-dlp from Alpine, ffmpeg, build tools, node-pre-gyp)
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    curl \
    bash \
    make \
    g++ \
    yt-dlp \
 && npm install -g npm@latest node-pre-gyp

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 4000
CMD ["node", "src/index.js"]
