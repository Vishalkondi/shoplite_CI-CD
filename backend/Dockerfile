# ---- Backend image: Node.js + Express API ----
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Copy only the dependency manifests first. Docker caches this layer, so
# `npm ci` re-runs only when package*.json changes, not on every code edit.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY db ./db

# Run as the unprivileged "node" user that ships with the image.
USER node

EXPOSE 5000

# Docker marks the container "healthy" once the API answers.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
