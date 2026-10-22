package state

import (
	"fmt"
	"sync"
	"time"

	"dcs-radar/models"
)

// EventEngine manages and deduces tactical events from telemetry updates.
type EventEngine struct {
	mu     sync.RWMutex
	events []*models.Event
	maxLen int
}

// NewEventEngine creates a new event engine with a bounded circular buffer.
func NewEventEngine(maxLen int) *EventEngine {
	if maxLen <= 0 {
		maxLen = 1000
	}
	return &EventEngine{
		events: make([]*models.Event, 0, maxLen),
		maxLen: maxLen,
	}
}

// AddEvent adds an event to the ring buffer.
func (e *EventEngine) AddEvent(ev *models.Event) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if len(e.events) >= e.maxLen {
		// Drop oldest
		e.events = e.events[1:]
	}
	e.events = append(e.events, ev)
}

// GetEvents returns a slice of events matching optional filters.
func (e *EventEngine) GetEvents(limit int, eventType models.EventType, objectID string) []*models.Event {
	e.mu.RLock()
	defer e.mu.RUnlock()

	var result []*models.Event
	for i := len(e.events) - 1; i >= 0; i-- {
		ev := e.events[i]
		if eventType != "" && ev.Type != eventType {
			continue
		}
		if objectID != "" && ev.ObjectID != objectID && ev.TargetID != objectID {
			continue
		}
		result = append(result, ev)
		if limit > 0 && len(result) >= limit {
			break
		}
	}
	return result
}

// DeduceSpawnEvent creates a spawn event when a new object appears.
func (e *EventEngine) DeduceSpawnEvent(obj *models.Object, t time.Time, offset float64) *models.Event {
	desc := fmt.Sprintf("Objekt '%s' [%s] se objevil na bojišti", obj.Name, obj.ID)
	if obj.Category == models.CategoryWeapon {
		desc = fmt.Sprintf("Detekován odpal zbraně '%s' [%s]", obj.Name, obj.ID)
	}

	ev := &models.Event{
		ID:          fmt.Sprintf("ev_spawn_%s_%.2f", obj.ID, offset),
		Timestamp:   t,
		TimeOffset:  offset,
		Type:        models.EventSpawn,
		ObjectID:    obj.ID,
		ObjectName:  obj.Name,
		Description: desc,
		Derived:     false, // Directly observed in telemetry
		Details: map[string]any{
			"category":  obj.Category,
			"coalition": obj.Coalition,
			"altitude":  obj.CurrentTransform.Altitude,
			"pilot":     obj.Pilot,
		},
	}
	e.AddEvent(ev)
	return ev
}

// DeduceDespawnEvent creates a despawn or deduced kill event.
func (e *EventEngine) DeduceDespawnEvent(obj *models.Object, recentWeapons []*models.Object, t time.Time, offset float64) *models.Event {
	// Check if this might be a kill caused by an active missile
	var suspectedWeapon *models.Object
	for _, w := range recentWeapons {
		if w.Alive && w.Category == models.CategoryWeapon {
			// Check distance between weapon and object
			dist := calculateDistance(obj.CurrentTransform.Latitude, obj.CurrentTransform.Longitude,
				w.CurrentTransform.Latitude, w.CurrentTransform.Longitude)
			if dist < 2000 { // within 2km of despawn
				suspectedWeapon = w
				break
			}
		}
	}

	if suspectedWeapon != nil {
		ev := &models.Event{
			ID:          fmt.Sprintf("ev_kill_%s_%.2f", obj.ID, offset),
			Timestamp:   t,
			TimeOffset:  offset,
			Type:        models.EventDestroyed,
			ObjectID:    obj.ID,
			ObjectName:  obj.Name,
			TargetID:    suspectedWeapon.ID,
			TargetName:  suspectedWeapon.Name,
			Description: fmt.Sprintf("Pravděpodobné zničení objektu '%s' střelou '%s' (odvozeno algoritmem)", obj.Name, suspectedWeapon.Name),
			Derived:     true, // Explicitly tagged as deduced!
			Details: map[string]any{
				"deductionReason": "blízkost střely při zániku objektu (<2 km)",
				"weaponID":        suspectedWeapon.ID,
				"weaponName":      suspectedWeapon.Name,
			},
		}
		e.AddEvent(ev)
		return ev
	}

	// Normal despawn event
	ev := &models.Event{
		ID:          fmt.Sprintf("ev_despawn_%s_%.2f", obj.ID, offset),
		Timestamp:   t,
		TimeOffset:  offset,
		Type:        models.EventDespawn,
		ObjectID:    obj.ID,
		ObjectName:  obj.Name,
		Description: fmt.Sprintf("Objekt '%s' [%s] opustil bojiště (despawn)", obj.Name, obj.ID),
		Derived:     false,
		Details: map[string]any{
			"lastAlt": obj.CurrentTransform.Altitude,
			"lastLon": obj.CurrentTransform.Longitude,
			"lastLat": obj.CurrentTransform.Latitude,
		},
	}
	e.AddEvent(ev)
	return ev
}

func calculateDistance(lat1, lon1, lat2, lon2 float64) float64 {
	// Fast flat-earth approximation for close proximity check
	const degToM = 111320.0
	dLat := (lat2 - lat1) * degToM
	dLon := (lon2 - lon1) * degToM * 0.74 // cos(~42 deg)
	return dLat*dLat + dLon*dLon
}
