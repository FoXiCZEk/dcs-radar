package state

import (
	"testing"
	"time"

	"dcs-radar/acmi"
	"dcs-radar/models"
)

func TestStateManagerLifecycle(t *testing.T) {
	evEngine := NewEventEngine(100)
	mgr := NewManager(50, evEngine)

	refTime := time.Date(2026, 10, 22, 12, 0, 0, 0, time.UTC)
	mgr.SetReferenceTime(refTime)

	// 1. First record spawns object
	rec := &acmi.ParsedRecord{
		Type:       acmi.RecordTypeUpdate,
		ObjectID:   "1001",
		TimeOffset: 0,
		Timestamp:  refTime,
		Object: &models.Object{
			ID:        "1001",
			Name:      "F-16C Viper",
			Type:      "Air+FixedWing",
			Category:  models.CategoryAirFixedWing,
			Coalition: models.CoalitionBlue,
			CurrentTransform: models.Transform{
				Timestamp: refTime,
				Longitude: 41.5,
				Latitude:  42.0,
				Altitude:  5000,
				SpeedKts:  450,
			},
		},
	}

	obj, ev := mgr.ApplyRecord(rec)
	if obj == nil || ev == nil {
		t.Fatalf("expected spawned object and event, got obj=%v, ev=%v", obj, ev)
	}
	if ev.Type != models.EventSpawn {
		t.Errorf("expected EventSpawn, got %s", ev.Type)
	}

	// Verify active count and stats
	count, coals, cats := mgr.GetStats()
	if count != 1 {
		t.Errorf("expected count 1, got %d", count)
	}
	if coals["Blue"] != 1 {
		t.Errorf("expected Blue count 1, got %d", coals["Blue"])
	}
	if cats["AirFixedWing"] != 1 {
		t.Errorf("expected AirFixedWing count 1, got %d", cats["AirFixedWing"])
	}

	// 2. Trajectory trail addition
	rec2 := &acmi.ParsedRecord{
		Type:       acmi.RecordTypeUpdate,
		ObjectID:   "1001",
		TimeOffset: 10,
		Timestamp:  refTime.Add(10 * time.Second),
		Object: &models.Object{
			CurrentTransform: models.Transform{
				Timestamp: refTime.Add(10 * time.Second),
				Longitude: 41.6,
				Latitude:  42.1,
				Altitude:  5100,
				SpeedKts:  460,
			},
		},
	}
	obj2, _ := mgr.ApplyRecord(rec2)
	if len(obj2.Trail) < 2 {
		t.Errorf("expected at least 2 trail points, got %d", len(obj2.Trail))
	}

	// 3. Object deletion
	recDel := &acmi.ParsedRecord{
		Type:       acmi.RecordTypeDelete,
		ObjectID:   "1001",
		TimeOffset: 20,
		Timestamp:  refTime.Add(20 * time.Second),
	}
	objDel, evDel := mgr.ApplyRecord(recDel)
	if objDel == nil || evDel == nil {
		t.Fatalf("expected despawn object and event")
	}
	if evDel.Type != models.EventDespawn {
		t.Errorf("expected EventDespawn, got %s", evDel.Type)
	}

	activeCount, _, _ := mgr.GetStats()
	if activeCount != 0 {
		t.Errorf("expected 0 active objects after despawn, got %d", activeCount)
	}
}
