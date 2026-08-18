# Build context is the monorepo root (see fly.toml: [build] dockerfile = "apps/api/Dockerfile")
FROM node:22-alpine
WORKDIR /app

# Copy every workspace's package.json first so `npm ci` matches the committed
# root package-lock.json exactly (npm ci fails if the lockfile and the set of
# workspace package.json files it was generated against don't match).
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/webapp/package.json apps/webapp/package.json
COPY apps/website/package.json apps/website/package.json

RUN npm ci

COPY apps/api/src apps/api/src

WORKDIR /app/apps/api
EXPOSE 8787
CMD ["node", "src/index.js"]
