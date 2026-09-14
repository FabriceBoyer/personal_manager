FROM node:22-alpine AS frontend
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.26-alpine AS backend
WORKDIR /build
COPY go.mod main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o memoire .

FROM alpine:3.22
RUN addgroup -S memoire && adduser -S -G memoire memoire
WORKDIR /app
COPY --from=backend /build/memoire ./memoire
COPY --from=frontend /build/frontend/dist ./frontend/dist
RUN mkdir -p /app/data && chown -R memoire:memoire /app/data
USER memoire
ENV PORT=8080
EXPOSE 8080
VOLUME ["/app/data"]
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
ENTRYPOINT ["/app/memoire"]
