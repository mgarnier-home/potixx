package main

// Config regroupe les variables d'environnement POTIXX_*.
type Config struct {
	AdminPassword string
	DataPath      string
	Port          string
}

func loadConfig(getenv func(string) string) Config {
	return Config{
		AdminPassword: getenv("POTIXX_ADMIN_PASSWORD"),
		DataPath:      or(getenv("POTIXX_DATA_PATH"), "/data/predictions.json"),
		Port:          or(getenv("POTIXX_PORT"), "8080"),
	}
}

func or(v, fallback string) string {
	if v == "" {
		return fallback
	}
	return v
}
