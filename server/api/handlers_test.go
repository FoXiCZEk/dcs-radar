package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"dcs-radar/config"
	"dcs-radar/history"
	"dcs-radar/models"
	"dcs-radar/state"
)

func TestRESTHandlers(t *testing.T) {
	tempDB := "test_api_history.db"
	defer os.Remove(tempDB)
	defer os.Remove(tempDB + "-wal")
	defer os.Remove(tempDB + "-shm")

	cfg := config.DefaultConfig()
	evEngine := state.NewEventEngine(100)
	sm := state.NewManager(100, evEngine)
	hs, err := history.NewStore(tempDB)
	if err != nil {
		t.Fatalf("failed to create history store: %v", err)
	}
	defer hs.Close()

	handler := NewAPIHandler(cfg, sm, hs, nil)

	// 1. Health check
	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	w := httptest.NewRecorder()
	handler.HealthCheck(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 OK from health, got %d", w.Code)
	}

	// 2. Add sample object to state manager
	now := time.Now().UTC()
	testObj := &models.Object{
		ID:        "9001",
		Name:      "Mirage 2000C",
		Type:      "Air+FixedWing",
		Category:  models.CategoryAirFixedWing,
		Coalition: models.CoalitionBlue,
		Alive:     true,
		CurrentTransform: models.Transform{
			Timestamp: now,
			Longitude: 41.8,
			Latitude:  42.2,
			Altitude:  8000,
			SpeedKts:  520,
		},
	}
	_ = hs.SaveSample(testObj)

	// 3. Test Status endpoint
	req = httptest.NewRequest(http.MethodGet, "/api/v1/status", nil)
	w = httptest.NewRecorder()
	handler.GetStatus(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 OK from status, got %d", w.Code)
	}
	var status models.SystemStatus
	_ = json.Unmarshal(w.Body.Bytes(), &status)
	if status.Version == "" {
		t.Errorf("expected valid version string in status")
	}

	// 4. Test History Range endpoint
	req = httptest.NewRequest(http.MethodGet, "/api/v1/history/range", nil)
	w = httptest.NewRecorder()
	handler.GetHistoryRange(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 OK from history range, got %d", w.Code)
	}

	// 5. Test Public Config endpoint
	req = httptest.NewRequest(http.MethodGet, "/api/v1/config", nil)
	w = httptest.NewRecorder()
	handler.GetPublicConfig(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 OK from config, got %d", w.Code)
	}
	var mapCfg config.MapConfig
	_ = json.Unmarshal(w.Body.Bytes(), &mapCfg)
	if mapCfg.DefaultLat == 0 {
		t.Errorf("expected non-zero default lat")
	}
}
