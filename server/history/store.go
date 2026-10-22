package history

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"dcs-radar/models"

	_ "modernc.org/sqlite"
)

// Store provides high-performance persistence and historical querying of telemetry data.
type Store struct {
	db *sql.DB
	mu sync.RWMutex
}

// NewStore initializes a SQLite database with WAL mode and necessary tables.
func NewStore(dbPath string) (*Store, error) {
	// Enable WAL mode and synchronous=NORMAL for maximum write throughput
	dsn := fmt.Sprintf("%s?_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)&_pragma=temp_store(MEMORY)", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("chyba při otevírání databáze historie: %w", err)
	}

	// Limit connections to avoid lock contention in SQLite
	db.SetMaxOpenConns(4)
	db.SetMaxIdleConns(2)

	s := &Store{db: db}
	if err := s.initSchema(); err != nil {
		db.Close()
		return nil, fmt.Errorf("chyba při inicializaci schématu: %w", err)
	}

	return s, nil
}

func (s *Store) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS telemetry_samples (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		object_id TEXT NOT NULL,
		timestamp INTEGER NOT NULL, -- Unix millis
		time_offset REAL NOT NULL,
		name TEXT,
		type TEXT,
		category TEXT,
		coalition TEXT,
		color TEXT,
		lon REAL NOT NULL,
		lat REAL NOT NULL,
		alt REAL NOT NULL,
		roll REAL DEFAULT 0,
		pitch REAL DEFAULT 0,
		yaw REAL DEFAULT 0,
		speed_kts REAL DEFAULT 0,
		alive INTEGER NOT NULL DEFAULT 1
	);

	CREATE INDEX IF NOT EXISTS idx_samples_time_obj ON telemetry_samples(timestamp, object_id);
	CREATE INDEX IF NOT EXISTS idx_samples_obj_time ON telemetry_samples(object_id, timestamp);

	CREATE TABLE IF NOT EXISTS mission_events (
		id TEXT PRIMARY KEY,
		timestamp INTEGER NOT NULL,
		time_offset REAL NOT NULL,
		type TEXT NOT NULL,
		object_id TEXT,
		target_id TEXT,
		description TEXT,
		derived INTEGER NOT NULL DEFAULT 0,
		details_json TEXT
	);

	CREATE INDEX IF NOT EXISTS idx_events_time ON mission_events(timestamp);
	`
	_, err := s.db.Exec(schema)
	return err
}

// SaveSample writes an object telemetry sample.
func (s *Store) SaveSample(obj *models.Object) error {
	if obj == nil || !obj.CurrentTransform.Timestamp.After(time.Time{}) {
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	tsMillis := obj.CurrentTransform.Timestamp.UnixMilli()
	aliveInt := 0
	if obj.Alive {
		aliveInt = 1
	}

	query := `
	INSERT INTO telemetry_samples (
		object_id, timestamp, time_offset, name, type, category, coalition, color,
		lon, lat, alt, roll, pitch, yaw, speed_kts, alive
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
	`
	_, err := s.db.Exec(query,
		obj.ID,
		tsMillis,
		obj.CurrentTransform.TimeOffset,
		obj.Name,
		obj.Type,
		string(obj.Category),
		string(obj.Coalition),
		obj.Color,
		obj.CurrentTransform.Longitude,
		obj.CurrentTransform.Latitude,
		obj.CurrentTransform.Altitude,
		obj.CurrentTransform.Roll,
		obj.CurrentTransform.Pitch,
		obj.CurrentTransform.Yaw,
		obj.CurrentTransform.SpeedKts,
		aliveInt,
	)
	return err
}

// SaveEvent writes a mission event.
func (s *Store) SaveEvent(ev *models.Event) error {
	if ev == nil {
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	detailsBytes, _ := json.Marshal(ev.Details)
	derivedInt := 0
	if ev.Derived {
		derivedInt = 1
	}

	query := `
	INSERT OR REPLACE INTO mission_events (
		id, timestamp, time_offset, type, object_id, target_id, description, derived, details_json
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
	`
	_, err := s.db.Exec(query,
		ev.ID,
		ev.Timestamp.UnixMilli(),
		ev.TimeOffset,
		string(ev.Type),
		ev.ObjectID,
		ev.TargetID,
		ev.Description,
		derivedInt,
		string(detailsBytes),
	)
	return err
}

// GetHistoryRange returns the earliest and latest recorded sample timestamps and total sample count.
func (s *Store) GetHistoryRange() (time.Time, time.Time, int64, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var minMillis, maxMillis sql.NullInt64
	var count int64

	row := s.db.QueryRow("SELECT MIN(timestamp), MAX(timestamp), COUNT(*) FROM telemetry_samples;")
	if err := row.Scan(&minMillis, &maxMillis, &count); err != nil {
		return time.Time{}, time.Time{}, 0, err
	}

	if !minMillis.Valid || count == 0 {
		now := time.Now().UTC()
		return now, now, 0, nil
	}

	startTime := time.UnixMilli(minMillis.Int64).UTC()
	endTime := time.UnixMilli(maxMillis.Int64).UTC()
	return startTime, endTime, count, nil
}

// GetSnapshotAt reconstructs the state of all alive objects at a given historical timestamp.
func (s *Store) GetSnapshotAt(targetTime time.Time) ([]*models.Object, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	targetMillis := targetTime.UnixMilli()
	// Look back at most 60 seconds from target time to find the latest valid sample for each object
	windowStartMillis := targetMillis - 60000

	query := `
	WITH RankedSamples AS (
		SELECT 
			object_id, timestamp, time_offset, name, type, category, coalition, color,
			lon, lat, alt, roll, pitch, yaw, speed_kts, alive,
			ROW_NUMBER() OVER (PARTITION BY object_id ORDER BY timestamp DESC) as rn
		FROM telemetry_samples
		WHERE timestamp <= ? AND timestamp >= ?
	)
	SELECT 
		object_id, timestamp, time_offset, name, type, category, coalition, color,
		lon, lat, alt, roll, pitch, yaw, speed_kts, alive
	FROM RankedSamples
	WHERE rn = 1 AND alive = 1;
	`

	rows, err := s.db.Query(query, targetMillis, windowStartMillis)
	if err != nil {
		return nil, fmt.Errorf("chyba při dotazu na historický snapshot: %w", err)
	}
	defer rows.Close()

	var objects []*models.Object
	for rows.Next() {
		var (
			objID, name, unitType, catStr, coalStr, color string
			tsMillis                                      int64
			timeOffset                                    float64
			lon, lat, alt, roll, pitch, yaw, speedKts     float64
			aliveInt                                      int
		)

		if err := rows.Scan(
			&objID, &tsMillis, &timeOffset, &name, &unitType, &catStr, &coalStr, &color,
			&lon, &lat, &alt, &roll, &pitch, &yaw, &speedKts, &aliveInt,
		); err != nil {
			return nil, err
		}

		sampleTime := time.UnixMilli(tsMillis).UTC()
		obj := &models.Object{
			ID:        objID,
			Name:      name,
			Type:      unitType,
			Category:  models.Category(catStr),
			Coalition: models.Coalition(coalStr),
			Color:     color,
			Alive:     aliveInt == 1,
			CurrentTransform: models.Transform{
				TimeOffset: timeOffset,
				Timestamp:  sampleTime,
				Longitude:  lon,
				Latitude:   lat,
				Altitude:   alt,
				Roll:       roll,
				Pitch:      pitch,
				Yaw:        yaw,
				Heading:    yaw,
				SpeedKts:   speedKts,
			},
			LastSeen: sampleTime,
		}
		objects = append(objects, obj)
	}

	return objects, nil
}

// GetTrajectory returns the series of transforms for a specific object in a time window.
func (s *Store) GetTrajectory(objectID string, from, to time.Time) ([]models.Transform, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	fromMillis := from.UnixMilli()
	toMillis := to.UnixMilli()

	query := `
	SELECT timestamp, time_offset, lon, lat, alt, roll, pitch, yaw, speed_kts
	FROM telemetry_samples
	WHERE object_id = ? AND timestamp >= ? AND timestamp <= ?
	ORDER BY timestamp ASC;
	`

	rows, err := s.db.Query(query, objectID, fromMillis, toMillis)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trail []models.Transform
	for rows.Next() {
		var tsMillis int64
		var timeOffset, lon, lat, alt, roll, pitch, yaw, speedKts float64

		if err := rows.Scan(&tsMillis, &timeOffset, &lon, &lat, &alt, &roll, &pitch, &yaw, &speedKts); err != nil {
			return nil, err
		}

		trail = append(trail, models.Transform{
			Timestamp:  time.UnixMilli(tsMillis).UTC(),
			TimeOffset: timeOffset,
			Longitude:  lon,
			Latitude:   lat,
			Altitude:   alt,
			Roll:       roll,
			Pitch:      pitch,
			Yaw:        yaw,
			Heading:    yaw,
			SpeedKts:   speedKts,
		})
	}

	return trail, nil
}

// PruneOlderThan removes samples and events older than cutoff time.
func (s *Store) PruneOlderThan(cutoff time.Time) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	cutoffMillis := cutoff.UnixMilli()

	res, err := s.db.Exec("DELETE FROM telemetry_samples WHERE timestamp < ?;", cutoffMillis)
	if err != nil {
		return 0, fmt.Errorf("chyba při mazání starých telemetrických vzorků: %w", err)
	}
	deletedSamples, _ := res.RowsAffected()

	_, _ = s.db.Exec("DELETE FROM mission_events WHERE timestamp < ?;", cutoffMillis)

	return deletedSamples, nil
}

// Close closes the underlying database.
func (s *Store) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.db.Close()
}
