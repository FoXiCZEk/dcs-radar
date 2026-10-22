package models

import (
	"strings"
	"time"
)

// Coalition defines the side/alignment of an object.
type Coalition string

const (
	CoalitionBlue    Coalition = "Blue"
	CoalitionRed     Coalition = "Red"
	CoalitionNeutral Coalition = "Neutral"
	CoalitionUnknown Coalition = "Unknown"
)

// Category defines high-level classification.
type Category string

const (
	CategoryAirFixedWing Category = "AirFixedWing"
	CategoryAirRotor     Category = "AirRotor"
	CategoryGround       Category = "Ground"
	CategorySea          Category = "Sea"
	CategoryWeapon       Category = "Weapon"
	CategoryNavaid       Category = "Navaid"
	CategoryOther        Category = "Other"
)

// Transform represents 3D spatial coordinate and orientation at a given time.
type Transform struct {
	TimeOffset float64   `json:"timeOffset"`         // Seconds from reference time
	Timestamp  time.Time `json:"timestamp"`          // Absolute UTC timestamp
	Longitude  float64   `json:"longitude"`          // Degrees (-180 to 180)
	Latitude   float64   `json:"latitude"`           // Degrees (-90 to 90)
	Altitude   float64   `json:"altitude"`           // Meters MSL
	Roll       float64   `json:"roll,omitempty"`     // Degrees
	Pitch      float64   `json:"pitch,omitempty"`    // Degrees
	Yaw        float64   `json:"yaw,omitempty"`      // Degrees (heading 0-360)
	U          float64   `json:"u,omitempty"`        // Cartesian/native coordinate if present
	V          float64   `json:"v,omitempty"`        // Cartesian/native coordinate if present
	Heading    float64   `json:"heading,omitempty"`  // Calculated or reported heading
	SpeedMS    float64   `json:"speedMS,omitempty"`  // Ground speed in meters/second
	SpeedKts   float64   `json:"speedKts,omitempty"` // Ground speed in knots
}

// Object represents a tracked entity in the simulation.
type Object struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	Type             string            `json:"type"`
	Category         Category          `json:"category"`
	Coalition        Coalition         `json:"coalition"`
	Color            string            `json:"color"`
	Country          string            `json:"country,omitempty"`
	Pilot            string            `json:"pilot,omitempty"`
	Callsign         string            `json:"callsign,omitempty"`
	Group            string            `json:"group,omitempty"`
	Squawk           string            `json:"squawk,omitempty"`
	IAS              float64           `json:"ias,omitempty"`  // Indicated Air Speed (m/s)
	TAS              float64           `json:"tas,omitempty"`  // True Air Speed (m/s)
	Mach             float64           `json:"mach,omitempty"` // Mach number
	AOA              float64           `json:"aoa,omitempty"`  // Angle of Attack (deg)
	CurrentTransform Transform         `json:"currentTransform"`
	Trail            []Transform       `json:"trail,omitempty"` // Recent trajectory positions
	FirstSeen        time.Time         `json:"firstSeen"`
	LastSeen         time.Time         `json:"lastSeen"`
	Alive            bool              `json:"alive"`
	Properties       map[string]string `json:"properties,omitempty"` // Preserved raw properties
}

// EventType enumerates all telemetry events.
type EventType string

const (
	EventSpawn          EventType = "Spawn"
	EventDespawn        EventType = "Despawn"
	EventWeaponLaunch   EventType = "WeaponLaunch"
	EventImpact         EventType = "Impact"
	EventSpeedAnomaly   EventType = "SpeedAnomaly"
	EventAltAnomaly     EventType = "AltAnomaly"
	EventDestroyed      EventType = "Destroyed"
	EventCustomComment  EventType = "Comment"
)

// Event represents an explicit or deduced occurrence during mission execution.
type Event struct {
	ID          string         `json:"id"`
	Timestamp   time.Time      `json:"timestamp"`
	TimeOffset  float64        `json:"timeOffset"`
	Type        EventType      `json:"type"`
	ObjectID    string         `json:"objectId"`
	ObjectName  string         `json:"objectName,omitempty"`
	TargetID    string         `json:"targetId,omitempty"`
	TargetName  string         `json:"targetName,omitempty"`
	Description string         `json:"description"`
	Derived     bool           `json:"derived"` // TRUE if derived by algorithm, FALSE if explicitly in source
	Details     map[string]any `json:"details,omitempty"`
}

// DCSHealthStatus provides multi-port connectivity diagnostics for DCS World.
type DCSHealthStatus struct {
	TacviewPortOpen bool   `json:"tacviewPortOpen"`
	GamePortOpen    bool   `json:"gamePortOpen"`
	GRPCPortOpen    bool   `json:"grpcPortOpen"`
	State           string `json:"state"` // "connected", "paused", "offline"
	Message         string `json:"message"`
	Host            string `json:"host"`
	TacviewPort     int    `json:"tacviewPort"`
	GamePort        int    `json:"gamePort"`
	GRPCPort        int    `json:"grpcPort"`
}

// SystemStatus represents operational and health metrics.
type SystemStatus struct {
	SourceType             string           `json:"sourceType"`      // "tcp", "file", "simulator"
	ConnectionState        string           `json:"connectionState"` // "connected", "disconnected", "stale", "connecting", "paused"
	LastReceived           time.Time        `json:"lastReceived"`
	LatencyMs              int64            `json:"latencyMs"`
	ObjectCount            int              `json:"objectCount"`
	CoalitionCounts        map[string]int   `json:"coalitionCounts"`
	CategoryCounts         map[string]int   `json:"categoryCounts"`
	HistoryDurationMinutes float64          `json:"historyDurationMinutes"`
	HistoryStartTime       time.Time        `json:"historyStartTime"`
	HistoryEndTime         time.Time        `json:"historyEndTime"`
	TotalHistoryRecords    int64            `json:"totalHistoryRecords"`
	Version                string           `json:"version"`
	DCSHealth              *DCSHealthStatus `json:"dcsHealth,omitempty"`
	Theatre                string           `json:"theatre,omitempty"`
	PlayerCount            int              `json:"playerCount,omitempty"`
	MissionTime            string           `json:"missionTime,omitempty"`
}

// DCSPlayer represents a connected pilot or player from DCS-gRPC.
type DCSPlayer struct {
	ID        uint32 `json:"id"`
	Name      string `json:"name"`
	Coalition string `json:"coalition"`
	Ping      int64  `json:"ping"`
}

// DCSAirbase represents an airfield queried via DCS-gRPC.
type DCSAirbase struct {
	ID        uint32    `json:"id"`
	Name      string    `json:"name"`
	Coalition Coalition `json:"coalition"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Altitude  float64   `json:"altitude"`
}

// DCSWeather represents current atmospheric state.
type DCSWeather struct {
	Temperature float64 `json:"temperature"` // Celsius
	PressureQNH float64 `json:"pressureQNH"` // hPa (QNH)
	WindSpeed   float64 `json:"windSpeed"`   // m/s
	WindHeading float64 `json:"windHeading"` // degrees
}

// ResolveCoalition maps Tacview coalition/color strings to standard Coalition enum.
func ResolveCoalition(coalitionStr, colorStr string) Coalition {
	c := strings.ToLower(strings.TrimSpace(coalitionStr))
	col := strings.ToLower(strings.TrimSpace(colorStr))

	if strings.Contains(c, "allies") || strings.Contains(c, "blue") || strings.Contains(col, "blue") {
		return CoalitionBlue
	}
	if strings.Contains(c, "enemies") || strings.Contains(c, "red") || strings.Contains(col, "red") {
		return CoalitionRed
	}
	if strings.Contains(c, "neutral") || strings.Contains(col, "green") || strings.Contains(col, "orange") {
		return CoalitionNeutral
	}
	return CoalitionUnknown
}

// ResolveCategory analyzes Tacview Type string (e.g., "Air+FixedWing") into high level Category.
func ResolveCategory(typeStr string) Category {
	t := strings.ToLower(typeStr)
	switch {
	case strings.Contains(t, "weapon") || strings.Contains(t, "missile") || strings.Contains(t, "rocket") || strings.Contains(t, "bomb") || strings.Contains(t, "torpedo"):
		return CategoryWeapon
	case strings.Contains(t, "rotorcraft") || strings.Contains(t, "helicopter"):
		return CategoryAirRotor
	case strings.Contains(t, "air") || strings.Contains(t, "fixedwing"):
		return CategoryAirFixedWing
	case strings.Contains(t, "ground") || strings.Contains(t, "vehicle") || strings.Contains(t, "tank") || strings.Contains(t, "infantry") || strings.Contains(t, "structure"):
		return CategoryGround
	case strings.Contains(t, "sea") || strings.Contains(t, "watercraft") || strings.Contains(t, "ship") || strings.Contains(t, "boat") || strings.Contains(t, "submarine"):
		return CategorySea
	case strings.Contains(t, "navaid") || strings.Contains(t, "waypoint") || strings.Contains(t, "bullseye") || strings.Contains(t, "airfield"):
		return CategoryNavaid
	default:
		return CategoryOther
	}
}
