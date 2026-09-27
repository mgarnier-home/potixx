# syntax=docker/dockerfile:1

# --- Étape 1 : build de l'application Angular -------------------------------
FROM node:24.16-alpine AS build
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

# --- Étape 2 : nginx non privilégié servant le site statique -----------------
FROM nginxinc/nginx-unprivileged:alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/potixx/browser /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
