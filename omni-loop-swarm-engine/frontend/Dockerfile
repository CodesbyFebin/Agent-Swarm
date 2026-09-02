# --- Build stage ------------------------------------------------------- #
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Baked into the built JS at build time (Vite only reads VITE_-prefixed env
# vars during `vite build`). Defaults to the host-mapped backend port so
# `docker compose up` works out of the box; override with --build-arg for a
# different deployment target.
ARG VITE_API_BASE=http://localhost:5000
ENV VITE_API_BASE=$VITE_API_BASE

RUN npm run build

# --- Serve stage --------------------------------------------------------- #
FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
