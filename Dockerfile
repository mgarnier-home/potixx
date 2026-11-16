# syntax=docker/dockerfile:1

# --- Étape 1 : build de l'application Angular -------------------------------
# Le front est identique pour toutes les architectures : il se construit sur la plateforme du
# runner.
FROM --platform=$BUILDPLATFORM docker.io/library/node:24.16.0-alpine@sha256:21f403ab171f2dc89bad4dd69d7721bfd15f084ccb46cdd225f31f2bc59b5c9a AS front
WORKDIR /app

# Playwright n'est utilisé que pour les tests E2E (jamais lancés dans l'image) :
# on s'assure qu'aucun navigateur n'est téléchargé pendant `npm ci`.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Copie des seuls fichiers de dépendances d'abord pour profiter du cache Docker :
# tant que package*.json ne change pas, `npm ci` n'est pas rejoué.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# `ng build` télécharge les polices Google et les inline dans le CSS : cette
# étape a donc besoin d'un accès réseau pendant `docker build`.
RUN npm run build

# --- Étape 2 : binaire Go, front embarqué depuis backend/web/browser ---------
FROM --platform=$BUILDPLATFORM docker.io/library/golang:1.26.4-alpine@sha256:3ad57304ad93bbec8548a0437ad9e06a455660655d9af011d58b993f6f615648 AS back
ARG TARGETOS
ARG TARGETARCH
ARG VERSION=dev
ARG COMMIT=none
ARG DATE=unknown
WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
COPY --from=front /app/dist/potixx/browser/ ./web/browser/
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build \
    -ldflags="-X 'github.com/mgarnier-home/utils/buildinfo.Version=${VERSION}' -X 'github.com/mgarnier-home/utils/buildinfo.Commit=${COMMIT}' -X 'github.com/mgarnier-home/utils/buildinfo.Date=${DATE}'" \
    -o /out/potixx .

# --- Étape 3 : image finale --------------------------------------------------
FROM docker.io/library/alpine:3.24.3@sha256:be2656061b536c1883c4034790e21d0a09c5aaaf51968b89368a3c0371ea2c9a
# uid et gid fixes (10001) : un dossier monté sur /data doit appartenir à 10001:10001.
RUN addgroup -S -g 10001 potixx && adduser -S -u 10001 -G potixx -H -h /data potixx \
    && mkdir -p /data \
    && chown potixx:potixx /data
COPY --from=back /out/potixx /usr/local/bin/potixx
ENV POTIXX_DATA_PATH=/data/predictions.json
USER 10001:10001
WORKDIR /data
VOLUME /data
EXPOSE 8080
# Le port suit POTIXX_PORT (8080 par défaut), d'où le passage par sh -c.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD ["sh", "-c", "wget -qO- \"http://localhost:${POTIXX_PORT:-8080}/version\" > /dev/null || exit 1"]
ENTRYPOINT ["/usr/local/bin/potixx"]
