package history

import (
	"os"
	"testing"
	"time"

	"dcs-radar/models"
)

func TestHistoryStore(t *testing.T) {
	tempDB := "test_history.db"
	defer os.Remove(tempDB)
	defer os.Remove(tempDB + "-wal")
	defer os.Remove(tempDB + "-shm")

	store, err := NewStore(tempDB)
	if err != nil {
		t.Fatalf("failed to create store: %v", err)
	}
	defer store.Close()

	now := time.Now().UTC()

	// 1. Save sample for Object 1001
	obj1 := &models.Object{
		ID:        "1001",
		Name:      "F-16C Viper",
		Type:      "Air+FixedWing",
		Category:  models.CategoryAirFixedWing,
		Coalition: models.CoalitionBlue,
		Color:     "Blue",
		Alive:     true,
		CurrentTransform: models.Transform{
			TimeOffset: 10.0,
			Timestamp:  now.Add(-10 * time.Minute),
			Longitude:  41.5,
			Latitude:   42.0,
			Altitude:   5000,
			Yaw:        90,
			SpeedKts:   450,
		},
	}
	if err := store.SaveSample(obj1); err != nil {
		t.Fatalf("failed to save sample 1: %v", err)
	}

	// 2. Save another sample for Object 1001 later in time
	obj1Next := *obj1
	obj1Next.CurrentTransform = models.Transform{
		TimeOffset: 20.0,
		Timestamp:  now.Add(-5 * time.Minute),
		Longitude:  41.6,
		Latitude:   42.1,
		Altitude:   5200,
		Yaw:        95,
		SpeedKts:   460,
	}
	if err := store.SaveSample(&obj1Next); err != nil {
		t.Fatalf("failed to save sample 2: %v", err)
	}

	// 3. Test GetHistoryRange
	start, end, count, err := store.GetHistoryRange()
	if err != nil {
		t.Fatalf("failed to get history range: %v", err)
	}
	if count != 2 {
		t.Errorf("expected count 2, got %d", count)
	}
	if start.After(end) {
		t.Errorf("start %v should be before end %v", start, end)
	}

	// 4. Test GetSnapshotAt historical time
	snap, err := store.GetSnapshotAt(now.Add(-4 * time.Minute))
	if err != nil {
		t.Fatalf("failed to get snapshot: %v", err)
	}
	if len(snap) != 1 {
		t.Fatalf("expected 1 object in snapshot, got %d", len(snap))
	}
	if snap[0].ID != "1001" || snap[0].CurrentTransform.Latitude != 42.1 {
		t.Errorf("unexpected snapshot object: %+v", snap[0])
	}

	// 5. Test Pruning
	deleted, err := store.PruneOlderThan(now.Add(-7 * time.Minute))
	if err != nil {
		t.Fatalf("failed to prune: %v", err)
	}
	if deleted != 1 {
		t.Errorf("expected 1 deleted sample, got %d", deleted)
	}

	_, _, countAfter, _ := store.GetHistoryRange()
	if countAfter != 1 {
		t.Errorf("expected count 1 after prune, got %d", countAfter)
	}
}
