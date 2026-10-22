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
EXPOSE 5000
CMD ["node", "server.js"]
