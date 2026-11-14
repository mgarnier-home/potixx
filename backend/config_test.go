package main

import "testing"

func env(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func TestLoadConfigDefaults(t *testing.T) {
	got := loadConfig(env(nil))
	want := Config{DataPath: "/data/predictions.json", Port: "8080"}
	if got != want {
		t.Fatalf("loadConfig() = %+v, attendu %+v", got, want)
	}
}

func TestLoadConfigOverrides(t *testing.T) {
	got := loadConfig(env(map[string]string{
		"POTIXX_ADMIN_PASSWORD": "secret",
		"POTIXX_DATA_PATH":      "/tmp/p.json",
		"POTIXX_PORT":           "9000",
	}))
	want := Config{AdminPassword: "secret", DataPath: "/tmp/p.json", Port: "9000"}
	if got != want {
		t.Fatalf("loadConfig() = %+v, attendu %+v", got, want)
	}
}
