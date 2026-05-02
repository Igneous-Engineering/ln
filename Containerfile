# ============================================================================
# Stage 1: Build — compile to standalone binary
# ============================================================================
ARG TARGETPLATFORM
FROM --platform=${TARGETPLATFORM} docker.io/oven/bun:1 AS build

WORKDIR /app

# Install deps (including devDeps for type-checking)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Type check
RUN bunx tsc --noEmit

# Compile to standalone binary (auto-detects host architecture)
RUN bun build --compile --minify --sourcemap=none \
    ./server.ts \
    --outfile ./ln-server

# ============================================================================
# Stage 2: Runtime — distroless (glibc, no shell, no package manager)
# ============================================================================
ARG TARGETPLATFORM
FROM --platform=${TARGETPLATFORM} gcr.io/distroless/cc-debian12:nonroot

COPY --from=build --chown=nonroot:nonroot --chmod=555 /app/ln-server /app/ln-server

WORKDIR /app

USER nonroot:nonroot

EXPOSE 3000

ENV NODE_ENV=production

ENTRYPOINT ["/app/ln-server"]
