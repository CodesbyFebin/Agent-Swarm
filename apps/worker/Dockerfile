# Build context is the monorepo root (see fly.toml: [build] dockerfile = "apps/worker/Dockerfile")
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/webapp/package.json apps/webapp/package.json
COPY apps/website/package.json apps/website/package.json

RUN npm ci

COPY apps/worker/src apps/worker/src

WORKDIR /app/apps/worker
CMD ["node", "src/index.js"]
