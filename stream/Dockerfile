FROM node:20-alpine

# System deps: python3 for yt-dlp, ffmpeg for HLS transcoding
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    curl \
    bash \
    make \
    g++

# Install latest yt-dlp (Python zipapp — works on musl/Alpine)
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

# Wire the system yt-dlp into the location yt-dlp-exec npm package expects
RUN mkdir -p node_modules/yt-dlp-exec/bin && \
    ln -sf "$(which yt-dlp)" node_modules/yt-dlp-exec/bin/yt-dlp

# Ensure Node.js is discoverable as a JS runtime for yt-dlp
RUN ln -sf "$(which node)" /usr/local/bin/nodejs || true

# Copy only source — exclude downloads/, cookies.txt, etc.
COPY src/ ./src/

EXPOSE 4000
CMD ["node", "src/index.js"]
