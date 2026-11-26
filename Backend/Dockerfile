# Backend image: Node (API) + Python (scikit-learn ML scripts) + fonts for the ad compositor.
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip fonts-liberation fontconfig \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
# Retrain inside the image so the pickled model always matches the installed scikit-learn version
RUN python3 ml_artifacts/train.py
ENV NODE_ENV=production PYTHON_BIN=python3
# Run as the unprivileged "node" user, not root
RUN chown -R node:node /app
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
