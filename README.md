# Potixx

Site familial d'annonce de grossesse au thème pirate, avec deux onglets :

- **Chasse au trésor** : quatre énigmes sur une carte, puis la révélation du trésor ;
- **Pronostics** : chacun parie sur le sexe, la date de naissance, la taille, le poids, la couleur
  des yeux et le prénom du bébé. Les pronostics ne sont visibles que sur la page `/admin`,
  protégée par mot de passe.

Front Angular 22, servi avec l'API par un binaire Go (`backend/`) qui stocke les pronostics dans
un fichier JSON.

## Développement

```bash
npm ci
npm start                       # front sur http://localhost:4200, /api relayé vers :18080

cd backend                      # dans un autre terminal
POTIXX_PORT=18080 POTIXX_ADMIN_PASSWORD=dev POTIXX_DATA_PATH=../tmp/predictions.json go run .
```

## Vérifications

```bash
npm run lint && npm run format:check && npm test && npm run e2e
cd backend && go vet ./... && go test -race ./... && golangci-lint run
```

## Image Docker

```bash
docker build -t potixx . && docker run --rm -p 8080:8080 -e POTIXX_ADMIN_PASSWORD=dev potixx
```

| Variable                | Défaut                   | Rôle                                    |
| ----------------------- | ------------------------ | --------------------------------------- |
| `POTIXX_ADMIN_PASSWORD` | vide (admin désactivée)  | Mot de passe de la page `/admin`        |
| `POTIXX_DATA_PATH`      | `/data/predictions.json` | Fichier des pronostics (volume `/data`) |
| `POTIXX_PORT`           | `8080`                   | Port d'écoute                           |

Le dossier monté sur `/data` doit appartenir à `10001:10001`. `GET /version` renvoie la version,
le commit et la date de build.

## Publication

Après fusion dans `master` : `tag-release X.Y.Z`. Le tag `vX.Y.Z` déclenche
`.github/workflows/publish.yml`, qui publie `mgarnier11/potixx:X.Y.Z` et `latest` (amd64 et
arm64).
