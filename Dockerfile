# --- build stage: compile the static site ---
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first for layer caching.
COPY package*.json ./
RUN npm ci

# VITE_STATION_URL is inlined at build time (all Vite VITE_* vars are), so it
# must be a build ARG, not a runtime env var. Defaults to the public station.
ARG VITE_STATION_URL=https://www.getsubwave.com
ENV VITE_STATION_URL=$VITE_STATION_URL

COPY . .
RUN npm run build

# --- serve stage: nginx over the static dist/ ---
FROM nginx:alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
