package state

import (
	"fmt"
	"sync"
	"time"

	"dcs-radar/acmi"
	"dcs-radar/models"
)

// Manager maintains the live, thread-safe tactical state of all mission objects.
type Manager struct {
	mu             sync.RWMutex
	objects        map[string]*models.Object
	eventEngine    *EventEngine
	trailMaxPoints int
	referenceTime  time.Time
}

// NewManager creates a state manager.
func NewManager(trailMaxPoints int, eventEngine *EventEngine) *Manager {
	if trailMaxPoints <= 0 {
		trailMaxPoints = 120
	}
	return &Manager{
		objects:        make(map[string]*models.Object),
		eventEngine:    eventEngine,
		trailMaxPoints: trailMaxPoints,
		referenceTime:  time.Now().UTC(),
	}
}

// SetReferenceTime updates the base reference time.
func (m *Manager) SetReferenceTime(t time.Time) {
	m.mu.Lock()
	m.referenceTime = t
	m.mu.Unlock()
}

// ReferenceTime returns the current base time.
func (m *Manager) ReferenceTime() time.Time {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.referenceTime
}

// ApplyRecord updates the live world model with a parsed ACMI record.
func (m *Manager) ApplyRecord(rec *acmi.ParsedRecord) (*models.Object, *models.Event) {
	if rec == nil {
		return nil, nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	switch rec.Type {
	case acmi.RecordTypeGlobal:
		if refTimeStr, ok := rec.GlobalProperties["ReferenceTime"]; ok {
			if t, err := time.Parse(time.RFC3339, refTimeStr); err == nil {
				m.referenceTime = t
			}
		}
		return nil, nil

	case acmi.RecordTypeUpdate:
		if rec.Object == nil {
			return nil, nil
		}

		existing, exists := m.objects[rec.ObjectID]
		var ev *models.Event

		if !exists {
			// First time seen -> spawn event
			newObj := *rec.Object
			newObj.Alive = true
			newObj.FirstSeen = rec.Timestamp
			newObj.LastSeen = rec.Timestamp
			if newObj.CurrentTransform.Timestamp.IsZero() {
				newObj.CurrentTransform.Timestamp = rec.Timestamp
			}
			if newObj.CurrentTransform.Timestamp.After(time.Time{}) {
				newObj.Trail = []models.Transform{newObj.CurrentTransform}
			}
			m.objects[rec.ObjectID] = &newObj

			if m.eventEngine != nil {
				ev = m.eventEngine.DeduceSpawnEvent(&newObj, rec.Timestamp, rec.TimeOffset)
			}
			return &newObj, ev
		}

		// Update existing object
		existing.LastSeen = rec.Timestamp
		existing.Alive = true

		// Copy updated fields
		if rec.Object.Name != "" {
			existing.Name = rec.Object.Name
		}
		if rec.Object.Type != "" {
			existing.Type = rec.Object.Type
			existing.Category = rec.Object.Category
		}
		if rec.Object.Coalition != "" && rec.Object.Coalition != models.CoalitionUnknown {
			existing.Coalition = rec.Object.Coalition
		}
		if rec.Object.Color != "" {
			existing.Color = rec.Object.Color
		}
		if rec.Object.Pilot != "" {
			existing.Pilot = rec.Object.Pilot
		}
		if rec.Object.Country != "" {
			existing.Country = rec.Object.Country
		}
		if rec.Object.IAS > 0 {
			existing.IAS = rec.Object.IAS
		}
		if rec.Object.Mach > 0 {
			existing.Mach = rec.Object.Mach
		}

		// Merge properties
		for k, v := range rec.Object.Properties {
			if existing.Properties == nil {
				existing.Properties = make(map[string]string)
			}
			existing.Properties[k] = v
		}

		// Update transform and trail
		newTr := rec.Object.CurrentTransform
		if newTr.Timestamp.IsZero() {
			newTr.Timestamp = rec.Timestamp
		}
		if newTr.Timestamp.After(time.Time{}) {
			shouldAddTrail := true
			if len(existing.Trail) > 0 {
				lastTr := existing.Trail[len(existing.Trail)-1]
				// Deadband: add trail point only if moved > 15m or alt changed > 10m or dt > 2s
				dLat := (newTr.Latitude - lastTr.Latitude) * 111320.0
				dLon := (newTr.Longitude - lastTr.Longitude) * 111320.0 * 0.74
				distSq := dLat*dLat + dLon*dLon
				dAlt := newTr.Altitude - lastTr.Altitude
				dt := newTr.Timestamp.Sub(lastTr.Timestamp).Seconds()

				if distSq < 225.0 && dAlt*dAlt < 100.0 && dt < 2.0 {
					shouldAddTrail = false
				}
			}

			existing.CurrentTransform = newTr
			if shouldAddTrail {
				existing.Trail = append(existing.Trail, newTr)
				if len(existing.Trail) > m.trailMaxPoints {
					// Drop oldest trail point
					existing.Trail = existing.Trail[1:]
				}
			}
		}

		// Check for launch event if this is a weapon
		if existing.Category == models.CategoryWeapon && len(existing.Trail) == 1 && m.eventEngine != nil {
			ev = &models.Event{
				ID:          fmt.Sprintf("ev_launch_%s_%.2f", existing.ID, rec.TimeOffset),
				Timestamp:   rec.Timestamp,
				TimeOffset:  rec.TimeOffset,
				Type:        models.EventWeaponLaunch,
				ObjectID:    existing.ID,
				ObjectName:  existing.Name,
				Description: fmt.Sprintf("Odpal zbraně '%s' [%s]", existing.Name, existing.ID),
				Derived:     false,
				Details: map[string]any{
					"speedKts": newTr.SpeedKts,
					"altitude": newTr.Altitude,
				},
			}
			m.eventEngine.AddEvent(ev)
		}

		objCopy := *existing
		return &objCopy, ev

	case acmi.RecordTypeDelete:
		existing, exists := m.objects[rec.ObjectID]
		if !exists {
			return nil, nil
		}

		existing.Alive = false
		existing.LastSeen = rec.Timestamp

		var ev *models.Event
		if m.eventEngine != nil {
			// Find active weapons for impact deduction
			var activeWeapons []*models.Object
			for _, o := range m.objects {
				if o.Category == models.CategoryWeapon {
					activeWeapons = append(activeWeapons, o)
				}
			}
			ev = m.eventEngine.DeduceDespawnEvent(existing, activeWeapons, rec.Timestamp, rec.TimeOffset)
		}

		objCopy := *existing
		// Remove from active map to keep memory minimal
		delete(m.objects, rec.ObjectID)
		return &objCopy, ev
	}

	return nil, nil
}

// GetActiveObjects returns a snapshot of all currently alive objects.
func (m *Manager) GetActiveObjects() []*models.Object {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*models.Object, 0, len(m.objects))
	for _, obj := range m.objects {
		if obj.Alive {
			c := *obj
			result = append(result, &c)
		}
	}
	return result
}

// GetObject retrieves a single object by ID.
func (m *Manager) GetObject(id string) (*models.Object, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	obj, exists := m.objects[id]
	if !exists {
		return nil, false
	}
	c := *obj
	return &c, true
}

// GetStats returns counts by coalition and category.
func (m *Manager) GetStats() (int, map[string]int, map[string]int) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	coalitions := make(map[string]int)
	categories := make(map[string]int)
	activeCount := 0

	for _, obj := range m.objects {
		if !obj.Alive {
			continue
		}
		activeCount++
		coalitions[string(obj.Coalition)]++
		categories[string(obj.Category)]++
	}

	return activeCount, coalitions, categories
}

// EventEngine returns the associated event engine.
func (m *Manager) EventEngine() *EventEngine {
	return m.eventEngine
}
