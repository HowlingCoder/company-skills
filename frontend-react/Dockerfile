# The React frontend behind nginx, which also forwards /api to the backend.
# Build context: the repository root (see compose.yaml).
FROM node:24-slim AS build
WORKDIR /build
COPY frontend-react/package.json frontend-react/package-lock.json ./
RUN npm ci
COPY frontend-react/ ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine
COPY frontend-react/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist /usr/share/nginx/html
EXPOSE 8080
