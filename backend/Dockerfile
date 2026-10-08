# ==============================================================================
# MAChip Backend Dockerfile
# Includes Node.js 22 LTS + Chromium OS libraries for Puppeteer PDF rendering
# ==============================================================================

FROM node:22-bookworm-slim

# Install Chromium and OS dependencies required by Puppeteer and PostgreSQL client
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-freefont-ttf \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Point Puppeteer to the system-installed Chromium binary
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=development

WORKDIR /app

# Install dependencies first for Docker layer caching
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Ensure uploads directory exists
RUN mkdir -p uploads/ProfilePictures uploads/requestsFiles

# Expose HTTP (REST / Socket.IO) and UDP (ESP32 Attendance Broadcast Discovery)
EXPOSE 4000
EXPOSE 4001/udp

# Entrypoint runs migrations then launches backend
CMD ["sh", "-c", "npx sequelize-cli db:migrate && node src/app.js"]
