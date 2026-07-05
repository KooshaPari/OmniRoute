// Package config loads OmniRoute config from env vars and TOML file.
// Precedence: env > TOML > defaults.
package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	// Server
	ListenAddr   string        `toml:"listen_addr"`
	ReadTimeout  time.Duration `toml:"read_timeout"`
	WriteTimeout time.Duration `toml:"write_timeout"`
	IdleTimeout  time.Duration `toml:"idle_timeout"`
	DataDir      string        `toml:"data_dir"`

	// Logging
	LogLevel string `toml:"log_level"`
	LogJSON  bool   `toml:"log_json"`

	// Auth
	APIKey string `toml:"api_key"`

	// Provider registry
	Providers map[string]ProviderConfig `toml:"providers"`

	// Mode
	ShadowMode bool `toml:"shadow_mode"` // when true: receive but never serve
}

type ProviderConfig struct {
	Type    string            `toml:"type"`     // "openai" | "anthropic" | ...
	BaseURL string            `toml:"base_url"` // override upstream base URL
	APIKey  string            `toml:"api_key"`  // override per-provider
	Headers map[string]string `toml:"headers"`
	Enabled bool              `toml:"enabled"`
}

func Default() Config {
	return Config{
		ListenAddr:   ":8080",
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 0, // 0 = no timeout (streaming)
		IdleTimeout:  120 * time.Second,
		DataDir:      defaultDataDir(),
		LogLevel:     "info",
		LogJSON:      true,
		Providers:    map[string]ProviderConfig{},
	}
}

func defaultDataDir() string {
	if d := os.Getenv("OMNIROUTE_DATA_DIR"); d != "" {
		return d
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "/tmp/omniroute"
	}
	return filepath.Join(home, ".omniroute")
}

// Load builds a Config from defaults, an optional TOML file at $OMNIROUTE_CONFIG,
// and env vars. Env wins.
func Load(path string) (Config, error) {
	c := Default()
	if path == "" {
		path = os.Getenv("OMNIROUTE_CONFIG")
	}
	if path != "" {
		if err := loadTOML(path, &c); err != nil && !errors.Is(err, os.ErrNotExist) {
			return c, fmt.Errorf("config: load %s: %w", path, err)
		}
	}
	applyEnv(&c)
	if err := c.Validate(); err != nil {
		return c, err
	}
	return c, nil
}

func (c Config) Validate() error {
	if c.ListenAddr == "" {
		return errors.New("config: listen_addr is required")
	}
	if c.DataDir == "" {
		return errors.New("config: data_dir is required")
	}
	return nil
}

func applyEnv(c *Config) {
	if v := os.Getenv("OMNIROUTE_LISTEN"); v != "" {
		c.ListenAddr = v
	}
	if v := os.Getenv("OMNIROUTE_DATA_DIR"); v != "" {
		c.DataDir = v
	}
	if v := os.Getenv("OMNIROUTE_LOG_LEVEL"); v != "" {
		c.LogLevel = v
	}
	if v := os.Getenv("OMNIROUTE_LOG_JSON"); v != "" {
		c.LogJSON, _ = strconv.ParseBool(v)
	}
	if v := os.Getenv("OMNIROUTE_API_KEY"); v != "" {
		c.APIKey = v
	}
	if v := os.Getenv("OMNIROUTE_SHADOW_MODE"); v != "" {
		c.ShadowMode, _ = strconv.ParseBool(v)
	}
}

func loadTOML(path string, c *Config) error {
	// Minimal TOML reader. The first slice only needs [server] and [providers.NAME].
	// For richer parsing, swap in github.com/BurntSushi/toml later.
	b, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	s := string(b)
	// Tiny subset: key = "value" or key = value lines under [section] / [providers.NAME]
	section := ""
	providerName := ""
	for _, raw := range strings.Split(s, "\n") {
		line := strings.TrimSpace(raw)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			header := strings.TrimSuffix(strings.TrimPrefix(line, "["), "]")
			if strings.HasPrefix(header, "providers.") {
				providerName = strings.TrimPrefix(header, "providers.")
				section = "providers"
				if c.Providers == nil {
					c.Providers = map[string]ProviderConfig{}
				}
				c.Providers[providerName] = ProviderConfig{Enabled: true}
			} else {
				section = header
				providerName = ""
			}
			continue
		}
		eq := strings.IndexByte(line, '=')
		if eq < 0 {
			continue
		}
		key := strings.TrimSpace(line[:eq])
		val := strings.Trim(strings.TrimSpace(line[eq+1:]), `"`)
		switch section {
		case "":
			applyTopLevel(c, key, val)
		case "server":
			applyServer(c, key, val)
		case "logging":
			applyLogging(c, key, val)
		case "providers":
			if providerName != "" {
				pc := c.Providers[providerName]
				applyProvider(&pc, key, val)
				c.Providers[providerName] = pc
			}
		}
	}
	return nil
}

func applyTopLevel(c *Config, k, v string)         {}
func applyServer(c *Config, k, v string)           { _ = k; _ = v }
func applyLogging(c *Config, k, v string)          { _ = k; _ = v }
func applyProvider(p *ProviderConfig, k, v string) { _ = k; _ = v }
