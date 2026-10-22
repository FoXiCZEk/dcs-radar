package api

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dcs-radar/config"
	"dcs-radar/history"
	"dcs-radar/models"
	"dcs-radar/state"
	"dcs-radar/telemetry"
)

// APIHandler contains handlers for REST endpoints.
type APIHandler struct {
	cfg          *config.Config
	stateManager *state.Manager
	historyStore *history.Store
	source       telemetry.Source
	startTime    time.Time
}

// NewAPIHandler creates a REST API handler instance.
func NewAPIHandler(cfg *config.Config, sm *state.Manager, hs *history.Store, src telemetry.Source) *APIHandler {
	return &APIHandler{
		cfg:          cfg,
		stateManager: sm,
		historyStore: hs,
		source:       src,
		startTime:    time.Now().UTC(),
	}
}

// writeJSON writes a JSON response with proper headers.
func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// writeError writes a structured JSON error.
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// HealthCheck responds with basic server status.
func (h *APIHandler) HealthCheck(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "healthy",
		"time":   time.Now().UTC(),
		"uptime": time.Since(h.startTime).String(),
	})
}

// ReadinessCheck verifies all critical subsystems are active.
func (h *APIHandler) ReadinessCheck(w http.ResponseWriter, _ *http.Request) {
	ready := h.source != nil && h.historyStore != nil && h.stateManager != nil
	if !ready {
		writeError(w, http.StatusServiceUnavailable, "Systém ještě není připraven")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

// GetStatus returns operational and telemetry health metrics.
func (h *APIHandler) GetStatus(w http.ResponseWriter, _ *http.Request) {
	activeCount, coalitions, categories := h.stateManager.GetStats()
	histStart, histEnd, histCount, _ := h.historyStore.GetHistoryRange()

	sourceType := "unknown"
	connState := "disconnected"
	var lastReceived time.Time
	var latencyMs int64

	if h.source != nil {
		sourceType = h.source.Type()
		lastReceived = h.source.LastReceived()
		if h.source.IsConnected() {
			if !lastReceived.IsZero() && time.Since(lastReceived) > 15*time.Second {
				connState = "stale"
			} else {
				connState = "connected"
			}
			if !lastReceived.IsZero() {
				latencyMs = time.Since(lastReceived).Milliseconds()
			}
		}
	}

	var dcsHealth *models.DCSHealthStatus
	if healthProvider, ok := h.source.(interface{ GetDCSHealth() *models.DCSHealthStatus }); ok {
		dcsHealth = healthProvider.GetDCSHealth()
		if dcsHealth != nil {
			if dcsHealth.State == "paused" {
				connState = "paused"
			} else if dcsHealth.State == "offline" {
				connState = "disconnected"
			} else if dcsHealth.State == "connected" && h.source.IsConnected() {
				connState = "connected"
			}
		}
	}

	histDurationMin := 0.0
	if !histStart.IsZero() && !histEnd.IsZero() && histEnd.After(histStart) {
		histDurationMin = histEnd.Sub(histStart).Minutes()
	}

	status := models.SystemStatus{
		SourceType:             sourceType,
		ConnectionState:        connState,
		LastReceived:           lastReceived,
		LatencyMs:              latencyMs,
		ObjectCount:            activeCount,
		CoalitionCounts:        coalitions,
		CategoryCounts:         categories,
		HistoryDurationMinutes: histDurationMin,
		HistoryStartTime:       histStart,
		HistoryEndTime:         histEnd,
		TotalHistoryRecords:    histCount,
		Version:                "1.0.0",
		DCSHealth:              dcsHealth,
	}

	writeJSON(w, http.StatusOK, status)
}

// GetObjects returns all active objects.
func (h *APIHandler) GetObjects(w http.ResponseWriter, _ *http.Request) {
	objects := h.stateManager.GetActiveObjects()
	writeJSON(w, http.StatusOK, map[string]any{
		"count":   len(objects),
		"objects": objects,
	})
}

// GetObjectDetail returns a single object by ID including trajectory trail.
func (h *APIHandler) GetObjectDetail(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 4 {
		writeError(w, http.StatusBadRequest, "Chybí ID objektu")
		return
	}
	id := parts[3]

	obj, found := h.stateManager.GetObject(id)
	if !found {
		writeError(w, http.StatusNotFound, fmt.Sprintf("Objekt '%s' nebyl nalezen", id))
		return
	}

	writeJSON(w, http.StatusOK, obj)
}

// GetHistoryRange returns available time range and statistics.
func (h *APIHandler) GetHistoryRange(w http.ResponseWriter, _ *http.Request) {
	start, end, count, err := h.historyStore.GetHistoryRange()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"startTime":        start,
		"endTime":          end,
		"totalRecords":     count,
		"retentionMinutes": h.cfg.History.RetentionMinutes,
	})
}

// GetHistorySnapshot reconstructs the world state at a historical timestamp.
func (h *APIHandler) GetHistorySnapshot(w http.ResponseWriter, r *http.Request) {
	timeStr := r.URL.Query().Get("time")
	if timeStr == "" {
		writeError(w, http.StatusBadRequest, "Parametr 'time' je povinný (ISO 8601)")
		return
	}

	targetTime, err := time.Parse(time.RFC3339Nano, timeStr)
	if err != nil {
		targetTime, err = time.Parse(time.RFC3339, timeStr)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Neplatný formát času, použijte RFC3339 (např. 2026-10-22T10:00:00Z)")
			return
		}
	}

	objects, err := h.historyStore.GetSnapshotAt(targetTime)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"time":    targetTime,
		"count":   len(objects),
		"objects": objects,
	})
}

// GetEvents returns recent mission events.
func (h *APIHandler) GetEvents(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 100
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 500 {
		limit = l
	}

	eventType := models.EventType(r.URL.Query().Get("type"))
	objectID := r.URL.Query().Get("objectId")

	events := h.stateManager.EventEngine().GetEvents(limit, eventType, objectID)
	writeJSON(w, http.StatusOK, map[string]any{
		"count":  len(events),
		"events": events,
	})
}

// GetPublicConfig returns safe map settings and units for the frontend.
func (h *APIHandler) GetPublicConfig(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, h.cfg.Map)
}

// ExportHistory exports telemetry data in GeoJSON or CSV format.
func (h *APIHandler) ExportHistory(w http.ResponseWriter, r *http.Request) {
	format := strings.ToLower(r.URL.Query().Get("format"))
	if format == "" {
		format = "geojson"
	}

	fromStr := r.URL.Query().Get("from")
	toStr := r.URL.Query().Get("to")

	fromTime := time.Now().UTC().Add(-60 * time.Minute)
	toTime := time.Now().UTC()

	if fromStr != "" {
		if t, err := time.Parse(time.RFC3339, fromStr); err == nil {
			fromTime = t
		}
	}
	if toStr != "" {
		if t, err := time.Parse(time.RFC3339, toStr); err == nil {
			toTime = t
		}
	}

	objectID := r.URL.Query().Get("objectId")

	if format == "csv" {
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", "attachment; filename=\"dcs_radar_telemetry.csv\"")

		writer := csv.NewWriter(w)
		defer writer.Flush()

		_ = writer.Write([]string{"Timestamp", "TimeOffset", "ObjectID", "Lon", "Lat", "AltMSL", "SpeedKts", "Heading", "Roll", "Pitch"})

		if objectID != "" {
			trail, err := h.historyStore.GetTrajectory(objectID, fromTime, toTime)
			if err == nil {
				for _, tr := range trail {
					_ = writer.Write([]string{
						tr.Timestamp.Format(time.RFC3339),
						fmt.Sprintf("%.2f", tr.TimeOffset),
						objectID,
						fmt.Sprintf("%.6f", tr.Longitude),
						fmt.Sprintf("%.6f", tr.Latitude),
						fmt.Sprintf("%.1f", tr.Altitude),
						fmt.Sprintf("%.1f", tr.SpeedKts),
						fmt.Sprintf("%.1f", tr.Heading),
						fmt.Sprintf("%.1f", tr.Roll),
						fmt.Sprintf("%.1f", tr.Pitch),
					})
				}
			}
		}
		return
	}

	// Default: GeoJSON FeatureCollection
	features := []map[string]any{}
	if objectID != "" {
		trail, err := h.historyStore.GetTrajectory(objectID, fromTime, toTime)
		if err == nil && len(trail) > 1 {
			var coordinates [][]float64
			for _, tr := range trail {
				coordinates = append(coordinates, []float64{tr.Longitude, tr.Latitude, tr.Altitude})
			}

			features = append(features, map[string]any{
				"type": "Feature",
				"properties": map[string]any{
					"objectId":  objectID,
					"startTime": fromTime,
					"endTime":   toTime,
				},
				"geometry": map[string]any{
					"type":        "LineString",
					"coordinates": coordinates,
				},
			})
		}
	} else {
		// All active objects as points
		objects := h.stateManager.GetActiveObjects()
		for _, o := range objects {
			features = append(features, map[string]any{
				"type": "Feature",
				"properties": map[string]any{
					"id":        o.ID,
					"name":      o.Name,
					"type":      o.Type,
					"coalition": o.Coalition,
					"category":  o.Category,
					"speedKts":  o.CurrentTransform.SpeedKts,
					"altM":      o.CurrentTransform.Altitude,
					"heading":   o.CurrentTransform.Heading,
				},
				"geometry": map[string]any{
					"type":        "Point",
					"coordinates": []float64{o.CurrentTransform.Longitude, o.CurrentTransform.Latitude, o.CurrentTransform.Altitude},
				},
			})
		}
	}

	geoJSON := map[string]any{
		"type":     "FeatureCollection",
		"features": features,
	}

	w.Header().Set("Content-Disposition", "attachment; filename=\"dcs_radar_telemetry.geojson\"")
	writeJSON(w, http.StatusOK, geoJSON)
}
