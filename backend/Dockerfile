FROM debian:trixie-slim
RUN apt-get update && apt-get install -y ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY target/release/dale-backend /usr/local/bin/app
ENTRYPOINT ["/usr/local/bin/app"]
