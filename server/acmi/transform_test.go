package acmi

import (
	"math"
	"testing"
	"time"

	"dcs-radar/models"
)

func TestParseTransformBasic(t *testing.T) {
	refTime := time.Date(2026, 10, 22, 12, 0, 0, 0, time.UTC)
	tStr := "T=41.52123|42.10543|3500.5|10.2|-3.5|180.0"

	tr, ok := ParseTransform(tStr, nil, 10.0, refTime)
	if !ok {
		t.Fatalf("expected ParseTransform to succeed")
	}

	if math.Abs(tr.Longitude-41.52123) > 1e-5 {
		t.Errorf("expected lon 41.52123, got %f", tr.Longitude)
	}
	if math.Abs(tr.Latitude-42.10543) > 1e-5 {
		t.Errorf("expected lat 42.10543, got %f", tr.Latitude)
	}
	if math.Abs(tr.Altitude-3500.5) > 1e-2 {
		t.Errorf("expected alt 3500.5, got %f", tr.Altitude)
	}
	if math.Abs(tr.Yaw-180.0) > 1e-2 {
		t.Errorf("expected yaw 180.0, got %f", tr.Yaw)
	}
}

func TestParseTransformSparse(t *testing.T) {
	refTime := time.Date(2026, 10, 22, 12, 0, 0, 0, time.UTC)
	prev := &models.Transform{
		TimeOffset: 0,
		Timestamp:  refTime,
		Longitude:  41.0,
		Latitude:   42.0,
		Altitude:   2000,
		Roll:       15,
		Pitch:      5,
		Yaw:        90,
	}

	// Update only coordinates, keeping roll/pitch/yaw
	tStr := "T=41.05|42.02|2050|||"
	tr, ok := ParseTransform(tStr, prev, 5.0, refTime)
	if !ok {
		t.Fatalf("expected ParseTransform to succeed")
	}

	if math.Abs(tr.Longitude-41.05) > 1e-5 {
		t.Errorf("expected updated lon 41.05, got %f", tr.Longitude)
	}
	if math.Abs(tr.Roll-15.0) > 1e-2 {
		t.Errorf("expected preserved roll 15.0, got %f", tr.Roll)
	}
	if math.Abs(tr.Yaw-90.0) > 1e-2 {
		t.Errorf("expected preserved yaw 90.0, got %f", tr.Yaw)
	}
	if tr.SpeedKts <= 0 {
		t.Errorf("expected positive derived speed, got %f", tr.SpeedKts)
	}
}

func TestHaversineAndBearing(t *testing.T) {
	// Batumi (41.6168, 41.6367) to Kobuleti (41.8167, 41.7667)
	lat1, lon1 := 41.6168, 41.6367
	lat2, lon2 := 41.8167, 41.7667

	dist := HaversineDistance(lat1, lon1, lat2, lon2)
	if dist < 20000 || dist > 30000 {
		t.Errorf("expected distance between 20-30km, got %f meters", dist)
	}

	bearing := CalculateBearing(lat1, lon1, lat2, lon2)
	if bearing < 0 || bearing > 45 {
		t.Errorf("expected North-Northeast bearing (0-45 deg), got %f", bearing)
	}
}
