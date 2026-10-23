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

	tr, ok := ParseTransform(tStr, nil, 10.0, refTime, 0, 0)
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

func TestParseTransformWithReferenceOffsets(t *testing.T) {
	refTime := time.Date(2026, 10, 22, 12, 0, 0, 0, time.UTC)
	// Caucasus reference: ReferenceLongitude=36, ReferenceLatitude=38
	tStr := "T=1.3511962|6.443433|0|0|0|132.1"

	tr, ok := ParseTransform(tStr, nil, 54.0, refTime, 36.0, 38.0)
	if !ok {
		t.Fatalf("expected ParseTransform to succeed")
	}

	expectedLon := 36.0 + 1.3511962
	expectedLat := 38.0 + 6.443433

	if math.Abs(tr.Longitude-expectedLon) > 1e-5 {
		t.Errorf("expected lon %f, got %f", expectedLon, tr.Longitude)
	}
	if math.Abs(tr.Latitude-expectedLat) > 1e-5 {
		t.Errorf("expected lat %f, got %f", expectedLat, tr.Latitude)
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
	tStr := "T=5.05|4.02|2050|||"
	// With reference offsets 36.0 and 38.0: 5.05+36=41.05, 4.02+38=42.02
	tr, ok := ParseTransform(tStr, prev, 5.0, refTime, 36.0, 38.0)
	if !ok {
		t.Fatalf("expected ParseTransform to succeed")
	}

	if math.Abs(tr.Longitude-41.05) > 1e-5 {
		t.Errorf("expected updated lon 41.05, got %f", tr.Longitude)
	}
	if math.Abs(tr.Latitude-42.02) > 1e-5 {
		t.Errorf("expected updated lat 42.02, got %f", tr.Latitude)
	}
	if math.Abs(tr.Roll-15.0) > 1e-2 {
		t.Errorf("expected preserved roll 15.0, got %f", tr.Roll)
	}
	if math.Abs(tr.Yaw-90.0) > 1e-2 {
		t.Errorf("expected preserved yaw 90.0, got %f", tr.Yaw)
	}
}
