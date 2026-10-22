package telemetry

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"dcs-radar/models"

	"github.com/DCS-gRPC/go-bindings/dcs/v0/atmosphere"
	"github.com/DCS-gRPC/go-bindings/dcs/v0/common"
	"github.com/DCS-gRPC/go-bindings/dcs/v0/mission"
	netgrpc "github.com/DCS-gRPC/go-bindings/dcs/v0/net"
	"github.com/DCS-gRPC/go-bindings/dcs/v0/world"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// DCSGRPCClient manages asynchronous interaction with the DCS-gRPC server.
type DCSGRPCClient struct {
	host     string
	port     int
	conn     *grpc.ClientConn
	mu       sync.RWMutex
	stopChan chan struct{}

	theatre     string
	players     []models.DCSPlayer
	airbases    []models.DCSAirbase
	weather     *models.DCSWeather
	missionTime string

	lastFetch time.Time
}

// NewDCSGRPCClient creates a new gRPC client for DCS.
func NewDCSGRPCClient(host string, port int) *DCSGRPCClient {
	return &DCSGRPCClient{
		host:     host,
		port:     port,
		stopChan: make(chan struct{}),
	}
}

// Start begins background polling of DCS metadata if gRPC is reachable.
func (c *DCSGRPCClient) Start() {
	go c.run()
}

// Stop shuts down the gRPC client connection and background loop.
func (c *DCSGRPCClient) Stop() {
	close(c.stopChan)
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn != nil {
		_ = c.conn.Close()
		c.conn = nil
	}
}

func (c *DCSGRPCClient) connect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn != nil {
		return nil
	}

	target := fmt.Sprintf("%s:%d", c.host, c.port)
	conn, err := grpc.Dial(target,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return err
	}
	c.conn = conn
	return nil
}

func (c *DCSGRPCClient) run() {
	ticker := time.NewTicker(8 * time.Second)
	defer ticker.Stop()

	// Initial fetch attempt
	_ = c.PollOnce()

	for {
		select {
		case <-c.stopChan:
			return
		case <-ticker.C:
			_ = c.PollOnce()
		}
	}
}

// PollOnce queries all relevant DCS-gRPC endpoints with timeouts.
func (c *DCSGRPCClient) PollOnce() error {
	if err := c.connect(); err != nil {
		return err
	}

	c.mu.RLock()
	conn := c.conn
	c.mu.RUnlock()

	if conn == nil {
		return fmt.Errorf("no gRPC connection")
	}

	// 1. Query Theatre (Map Name)
	worldClient := world.NewWorldServiceClient(conn)
	ctxTheatre, cancelTheatre := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancelTheatre()

	if resp, err := worldClient.GetTheatre(ctxTheatre, &world.GetTheatreRequest{}); err == nil && resp != nil {
		c.mu.Lock()
		c.theatre = resp.GetTheatre()
		c.mu.Unlock()
	}

	// 2. Query Players
	netClient := netgrpc.NewNetServiceClient(conn)
	ctxPlayers, cancelPlayers := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancelPlayers()

	if resp, err := netClient.GetPlayers(ctxPlayers, &netgrpc.GetPlayersRequest{}); err == nil && resp != nil {
		var players []models.DCSPlayer
		for _, p := range resp.GetPlayers() {
			coalStr := strings.ToLower(p.GetCoalition().String())
			coal := "Neutral"
			if strings.Contains(coalStr, "blue") || strings.Contains(coalStr, "allies") {
				coal = "Blue"
			} else if strings.Contains(coalStr, "red") || strings.Contains(coalStr, "enemies") {
				coal = "Red"
			}
			players = append(players, models.DCSPlayer{
				ID:        p.GetId(),
				Name:      p.GetName(),
				Coalition: coal,
				Ping:      int64(p.GetPing()),
			})
		}
		c.mu.Lock()
		c.players = players
		c.mu.Unlock()
	}

	// 3. Query Scenario Time
	missionClient := mission.NewMissionServiceClient(conn)
	ctxTime, cancelTime := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancelTime()

	if resp, err := missionClient.GetScenarioCurrentTime(ctxTime, &mission.GetScenarioCurrentTimeRequest{}); err == nil && resp != nil {
		c.mu.Lock()
		c.missionTime = resp.GetDatetime()
		c.mu.Unlock()
	}

	// 4. Query Weather / Atmosphere if not yet cached or every 30s
	c.mu.RLock()
	needWeather := c.weather == nil || time.Since(c.lastFetch) > 30*time.Second
	c.mu.RUnlock()

	if needWeather {
		atmoClient := atmosphere.NewAtmosphereServiceClient(conn)
		ctxAtmo, cancelAtmo := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancelAtmo()

		// Sample position at sea level
		pos := &common.InputPosition{
			Lat: 42.0,
			Lon: 42.0,
			Alt: 10.0,
		}
		if tpResp, err := atmoClient.GetTemperatureAndPressure(ctxAtmo, &atmosphere.GetTemperatureAndPressureRequest{Position: pos}); err == nil && tpResp != nil {
			var windSpd float64
			var windHdg float64

			ctxWind, cancelWind := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancelWind()
			if windResp, err := atmoClient.GetWind(ctxWind, &atmosphere.GetWindRequest{Position: pos}); err == nil && windResp != nil {
				windSpd = float64(windResp.GetStrength())
				windHdg = float64(windResp.GetHeading())
			}

			c.mu.Lock()
			c.weather = &models.DCSWeather{
				Temperature: float64(tpResp.GetTemperature()),
				PressureQNH: float64(tpResp.GetPressure()) / 100.0, // Pa to hPa
				WindSpeed:   windSpd,
				WindHeading: windHdg,
			}
			c.lastFetch = time.Now()
			c.mu.Unlock()
		}
	}

	return nil
}

// GetTheatre returns the detected DCS theater name.
func (c *DCSGRPCClient) GetTheatre() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.theatre
}

// GetPlayers returns the current list of connected DCS players.
func (c *DCSGRPCClient) GetPlayers() []models.DCSPlayer {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.players
}

// GetWeather returns the current atmospheric weather info.
func (c *DCSGRPCClient) GetWeather() *models.DCSWeather {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.weather
}

// GetMissionTime returns current DCS in-game scenario time string.
func (c *DCSGRPCClient) GetMissionTime() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.missionTime
}

// SendChatMessage sends a message to in-game DCS chat.
func (c *DCSGRPCClient) SendChatMessage(msg string) error {
	c.mu.RLock()
	conn := c.conn
	c.mu.RUnlock()

	if conn == nil {
		return fmt.Errorf("no gRPC connection")
	}

	netClient := netgrpc.NewNetServiceClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	_, err := netClient.SendChat(ctx, &netgrpc.SendChatRequest{
		Message: msg,
	})
	if err != nil {
		log.Printf("[DCS-gRPC] Failed to send in-game chat: %v", err)
		return err
	}
	return nil
}
