# syntax=docker/dockerfile:1

FROM golang:1.25.13-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/server ./cmd/server

FROM alpine:3.21
RUN apk add --no-cache ca-certificates su-exec \
	&& mkdir -p /data/uploads \
	&& chown nobody:nogroup /data/uploads
WORKDIR /app
COPY --from=build /out/server /app/server
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 8080
# Entrypoint starts as root only long enough to chown UPLOAD_DIR, then su-exec nobody.
ENTRYPOINT ["/docker-entrypoint.sh"]
