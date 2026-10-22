# Stage 1: Build React Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/web

# Install dependencies
COPY web/package*.json ./
RUN npm ci

# Copy sources and build production SPA bundle
COPY web/ ./
RUN npm run build

# Stage 2: Build Go Backend
FROM golang:1.26-alpine AS backend-builder
WORKDIR /app/server

# Install build tools
RUN apk add --no-cache git

# Download Go modules
COPY server/go.mod server/go.sum ./
RUN go mod download

# Copy backend sources and compile static binary
COPY server/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/dcs-radar main.go

# Stage 3: Minimal Production Runtime
FROM alpine:3.21
WORKDIR /app

# Install security certificates and tzdata
RUN apk add --no-cache ca-certificates tzdata wget

# Create non-root user
RUN addgroup -S radar && adduser -S radar -G radar

# Copy compiled backend binary
COPY --from=backend-builder /app/dcs-radar /app/dcs-radar

# Copy compiled frontend assets
COPY --from=frontend-builder /app/web/dist /app/web/dist

# Copy default configuration
COPY config.yaml /app/config.yaml

# Create persistent data directory and set permissions
RUN mkdir -p /app/data /data/tacview && chown -R radar:radar /app /data

USER radar

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/v1/health || exit 1

ENTRYPOINT ["/app/dcs-radar"]
CMD ["-config", "/app/config.yaml"]
