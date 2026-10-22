package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// ServerConfig configures HTTP and WebSocket server.
type ServerConfig struct {
	Host           string   `yaml:"host"`
	Port           int      `yaml:"port"`
	AllowedOrigins []string `yaml:"allowed_origins"`
	AuthEnabled    bool     `yaml:"auth_enabled"`
	AuthToken      string   `yaml:"auth_token"`
}

// TCPSourceConfig configures direct connection to Tacview Real-Time Telemetry server.
type TCPSourceConfig struct {
	Host                 string `yaml:"host"`
	Port                 int    `yaml:"port"`
	Password             string `yaml:"password"`
	ClientName           string `yaml:"client_name"`
	ReconnectIntervalSec int    `yaml:"reconnect_interval_sec"`
	TimeoutSec           int    `yaml:"timeout_sec"`
}

// FileSourceConfig configures continuous ACMI file tailing.
type FileSourceConfig struct {
	Path               string `yaml:"path"`
	Directory          string `yaml:"directory"`
	AutoDetectLatest   bool   `yaml:"auto_detect_latest"`
	PollIntervalMs     int    `yaml:"poll_interval_ms"`
}

// SimulatorConfig configures built-in telemetry simulation.
type SimulatorConfig struct {
	UpdateRateHz float64 `yaml:"update_rate_hz"`
	Scenario     string  `yaml:"scenario"`
}

// TelemetryConfig configures telemetry ingestion.
type TelemetryConfig struct {
	Type      string           `yaml:"type"` // "tcp", "file", "simulator"
	TCP       TCPSourceConfig  `yaml:"tcp"`
	File      FileSourceConfig `yaml:"file"`
	Simulator SimulatorConfig  `yaml:"simulator"`
}

// HistoryConfig configures telemetry history and retention.
type HistoryConfig struct {
	RetentionMinutes   int    `yaml:"retention_minutes"`
	DBPath             string `yaml:"db_path"`
	CleanupIntervalSec int    `yaml:"cleanup_interval_sec"`
	TrailMaxPoints     int    `yaml:"trail_max_points"`
}

// MapConfig configures frontend map display.
type MapConfig struct {
	DefaultLat     float64 `yaml:"default_lat" json:"defaultLat"`
	DefaultLon     float64 `yaml:"default_lon" json:"defaultLon"`
	DefaultZoom    float64 `yaml:"default_zoom" json:"defaultZoom"`
	TileURL        string  `yaml:"tile_url" json:"tileUrl"`
	Attribution    string  `yaml:"attribution" json:"attribution"`
	CesiumIonToken string  `yaml:"cesium_ion_token" json:"cesiumIonToken"`
	AltitudeUnit   string  `yaml:"altitude_unit" json:"altitudeUnit"` // "m" or "ft"
	SpeedUnit      string  `yaml:"speed_unit" json:"speedUnit"`       // "kts" or "kmh"
	Language       string  `yaml:"language" json:"language"`
}

// LoggingConfig configures logging behavior.
type LoggingConfig struct {
	Level  string `yaml:"level"`  // "debug", "info", "warn", "error"
	Format string `yaml:"format"` // "json", "console"
}

// Config represents the complete application configuration.
type Config struct {
	Server    ServerConfig    `yaml:"server"`
	Telemetry TelemetryConfig `yaml:"telemetry"`
	History   HistoryConfig   `yaml:"history"`
	Map       MapConfig       `yaml:"map"`
	Logging   LoggingConfig   `yaml:"logging"`
}

// DefaultConfig returns safe production fallback configuration.
func DefaultConfig() *Config {
	return &Config{
		Server: ServerConfig{
			Host:           "0.0.0.0",
			Port:           8080,
			AllowedOrigins: []string{"*"},
			AuthEnabled:    false,
			AuthToken:      "",
		},
		Telemetry: TelemetryConfig{
			Type: "simulator",
			TCP: TCPSourceConfig{
				Host:                 "127.0.0.1",
				Port:                 42674,
				Password:             "",
				ClientName:           "DCS-Radar",
				ReconnectIntervalSec: 5,
				TimeoutSec:           10,
			},
			File: FileSourceConfig{
				Path:             "./data/tacview/active.txt.acmi",
				Directory:        "./data/tacview",
				AutoDetectLatest: true,
				PollIntervalMs:   250,
			},
			Simulator: SimulatorConfig{
				UpdateRateHz: 5.0,
				Scenario:     "caucasus_dogfight",
			},
		},
		History: HistoryConfig{
			RetentionMinutes:   60,
			DBPath:             "./data/history.db",
			CleanupIntervalSec: 60,
			TrailMaxPoints:     120,
		},
		Map: MapConfig{
			DefaultLat:     42.15,
			DefaultLon:     41.80,
			DefaultZoom:    8.5,
			TileURL:        "https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
			Attribution:    "© OpenStreetMap contributors, © CARTO",
			CesiumIonToken: "",
			AltitudeUnit:   "m",
			SpeedUnit:      "kts",
			Language:       "cs",
		},
		Logging: LoggingConfig{
			Level:  "info",
			Format: "console",
		},
	}
}

// LoadConfig reads YAML file, applies defaults, and validates all properties.
func LoadConfig(path string) (*Config, error) {
	cfg := DefaultConfig()

	if path != "" {
		data, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("chyba při čtení konfiguračního souboru %s: %w", path, err)
		}

		if err := yaml.Unmarshal(data, cfg); err != nil {
			return nil, fmt.Errorf("chyba při parsování YAML konfigurace %s: %w", path, err)
		}
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("neplatná konfigurace: %w", err)
	}

	// Zajistit existenci adresářů pro databázi a data
	if cfg.History.DBPath != "" && cfg.History.DBPath != ":memory:" {
		dir := filepath.Dir(cfg.History.DBPath)
		if dir != "." && dir != "" {
			_ = os.MkdirAll(dir, 0755)
		}
	}

	return cfg, nil
}

// Validate checks for logical and semantic correctness of configuration fields.
func (c *Config) Validate() error {
	if c.Server.Port <= 0 || c.Server.Port > 65535 {
		return fmt.Errorf("server.port musí být v rozsahu 1-65535 (zadáno: %d)", c.Server.Port)
	}

	telemetryType := strings.ToLower(c.Telemetry.Type)
	switch telemetryType {
	case "tcp":
		if c.Telemetry.TCP.Host == "" {
			return fmt.Errorf("telemetry.tcp.host nesmí být prázdný pro typ 'tcp'")
		}
		if c.Telemetry.TCP.Port <= 0 || c.Telemetry.TCP.Port > 65535 {
			return fmt.Errorf("telemetry.tcp.port musí být v rozsahu 1-65535")
		}
	case "file":
		if c.Telemetry.File.Path == "" && c.Telemetry.File.Directory == "" {
			return fmt.Errorf("telemetry.file.path nebo directory musí být zadán pro typ 'file'")
		}
	case "simulator":
		if c.Telemetry.Simulator.UpdateRateHz <= 0 {
			c.Telemetry.Simulator.UpdateRateHz = 5.0
		}
	default:
		return fmt.Errorf("neplatný telemetry.type '%s'. Podporované: 'tcp', 'file', 'simulator'", c.Telemetry.Type)
	}

	if c.History.RetentionMinutes < 1 {
		return fmt.Errorf("history.retention_minutes musí být alespoň 1 minuta (doporučeno: 60)")
	}

	if c.Map.AltitudeUnit != "m" && c.Map.AltitudeUnit != "ft" {
		c.Map.AltitudeUnit = "m"
	}
	if c.Map.SpeedUnit != "kts" && c.Map.SpeedUnit != "kmh" {
		c.Map.SpeedUnit = "kts"
	}

	return nil
}
