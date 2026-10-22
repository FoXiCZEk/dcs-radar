package telemetry

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"dcs-radar/acmi"
	"dcs-radar/config"
)

// SimulatorSource generates high-fidelity tactical DCS Caucasus telemetry.
type SimulatorSource struct {
	cfg          config.SimulatorConfig
	parser       *acmi.Parser
	mu           sync.RWMutex
	connected    bool
	lastReceived time.Time
	cancel       context.CancelFunc
}

// NewSimulatorSource creates a new DCS mission simulator.
func NewSimulatorSource(cfg config.SimulatorConfig) *SimulatorSource {
	if cfg.UpdateRateHz <= 0 {
		cfg.UpdateRateHz = 5.0
	}
	return &SimulatorSource{
		cfg:    cfg,
		parser: acmi.NewParser(),
	}
}

func (s *SimulatorSource) Type() string {
	return "simulator"
}

func (s *SimulatorSource) IsConnected() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.connected
}

func (s *SimulatorSource) LastReceived() time.Time {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastReceived
}

func (s *SimulatorSource) setConnected(c bool) {
	s.mu.Lock()
	s.connected = c
	s.mu.Unlock()
}

func (s *SimulatorSource) updateLastReceived() {
	s.mu.Lock()
	s.lastReceived = time.Now().UTC()
	s.mu.Unlock()
}

func (s *SimulatorSource) Start(ctx context.Context) (<-chan *acmi.ParsedRecord, <-chan error) {
	recordCh := make(chan *acmi.ParsedRecord, 5000)
	errCh := make(chan error, 10)

	ctx, s.cancel = context.WithCancel(ctx)
	s.setConnected(true)

	go s.runSimulation(ctx, recordCh, errCh)

	return recordCh, errCh
}

func (s *SimulatorSource) Stop() error {
	if s.cancel != nil {
		s.cancel()
	}
	s.setConnected(false)
	return nil
}

type simUnit struct {
	id         string
	name       string
	unitType   string
	coalition  string
	color      string
	country    string
	pilot      string
	lat        float64
	lon        float64
	alt        float64
	speedKts   float64
	heading    float64
	roll       float64
	pitch      float64
	turnRate   float64
	alive      bool
	isMissile  bool
	targetID   string
	lifetimeS  float64
	ageS       float64
}

func (s *SimulatorSource) runSimulation(ctx context.Context, recordCh chan<- *acmi.ParsedRecord, _ chan<- error) {
	rate := s.cfg.UpdateRateHz
	dt := 1.0 / rate
	ticker := time.NewTicker(time.Duration(dt*1000) * time.Millisecond)
	defer ticker.Stop()

	// Mission reference time
	missionStart := time.Now().UTC()
	s.parser.SetReferenceTime(missionStart)

	// Emit ACMI headers
	s.emit(recordCh, "FileType=text/acmi/tacview")
	s.emit(recordCh, "FileVersion=2.2")
	s.emit(recordCh, fmt.Sprintf("0,ReferenceTime=%s,Title=DCS Caucasus Realtime Operation,DataRecorder=DCS Radar Simulator", missionStart.Format(time.RFC3339)))

	// Setup realistic scenario units (Caucasus / Georgia theater)
	units := map[string]*simUnit{
		"1001": {
			id: "1001", name: "F-16C Viper 1-1", unitType: "Air+FixedWing", coalition: "Allies", color: "Blue",
			country: "us", pilot: "Capt. 'Viper' Miller", lat: 41.80, lon: 41.50, alt: 6800, speedKts: 440,
			heading: 45, turnRate: 0.6, alive: true,
		},
		"1002": {
			id: "1002", name: "F-16C Viper 1-2", unitType: "Air+FixedWing", coalition: "Allies", color: "Blue",
			country: "us", pilot: "Lt. 'Ghost' Adams", lat: 41.79, lon: 41.52, alt: 6750, speedKts: 440,
			heading: 45, turnRate: 0.6, alive: true,
		},
		"1003": {
			id: "1003", name: "E-3A Sentry AWACS", unitType: "Air+FixedWing", coalition: "Allies", color: "Blue",
			country: "us", pilot: "Overlord Orbit", lat: 41.50, lon: 41.20, alt: 9400, speedKts: 370,
			heading: 0, turnRate: 0.3, alive: true,
		},
		"1004": {
			id: "1004", name: "KC-135 Stratotanker", unitType: "Air+FixedWing", coalition: "Allies", color: "Blue",
			country: "us", pilot: "Texaco 1-1", lat: 41.65, lon: 41.15, alt: 7800, speedKts: 390,
			heading: 180, turnRate: 0.25, alive: true,
		},
		"1005": {
			id: "1005", name: "USS Normandy CG-60", unitType: "Sea+Watercraft", coalition: "Allies", color: "Blue",
			country: "us", pilot: "Commander naval", lat: 41.65, lon: 41.40, alt: 0, speedKts: 22,
			heading: 330, turnRate: 0.05, alive: true,
		},
		"2001": {
			id: "2001", name: "Su-27 Flanker 2-1", unitType: "Air+FixedWing", coalition: "Enemies", color: "Red",
			country: "ru", pilot: "Maj. Ivanov", lat: 42.45, lon: 42.25, alt: 7200, speedKts: 480,
			heading: 225, turnRate: -0.5, alive: true,
		},
		"2002": {
			id: "2002", name: "MiG-29S Fulcrum", unitType: "Air+FixedWing", coalition: "Enemies", color: "Red",
			country: "ru", pilot: "Capt. Sokolov", lat: 42.35, lon: 42.40, alt: 5800, speedKts: 460,
			heading: 230, turnRate: -0.4, alive: true,
		},
		"2003": {
			id: "2003", name: "Mi-24P Hind", unitType: "Air+Rotorcraft", coalition: "Enemies", color: "Red",
			country: "ru", pilot: "Lt. Petrenko", lat: 42.20, lon: 42.10, alt: 180, speedKts: 130,
			heading: 190, turnRate: 0.2, alive: true,
		},
		"2004": {
			id: "2004", name: "SA-10 Grumble Radar", unitType: "Ground+Static+AntiAircraft", coalition: "Enemies", color: "Red",
			country: "ru", pilot: "Air Defense Battery", lat: 42.24, lon: 42.06, alt: 25, speedKts: 0,
			heading: 0, turnRate: 0, alive: true,
		},
		"2005": {
			id: "2005", name: "T-90A Armor Platoon", unitType: "Ground+Vehicle", coalition: "Enemies", color: "Red",
			country: "ru", pilot: "Tank Platoon Leader", lat: 42.15, lon: 42.15, alt: 40, speedKts: 25,
			heading: 210, turnRate: 0.05, alive: true,
		},
	}

	// Register initial units
	s.emit(recordCh, "#0.00")
	for _, u := range units {
		line := fmt.Sprintf("%s,T=%.5f|%.5f|%.1f|%.1f|%.1f|%.1f,Name=%s,Type=%s,Coalition=%s,Color=%s,Country=%s,Pilot=%s",
			u.id, u.lon, u.lat, u.alt, u.roll, u.pitch, u.heading, u.name, u.unitType, u.coalition, u.color, u.country, u.pilot)
		s.emit(recordCh, line)
	}

	simTime := 0.0
	missileCounter := 3000
	nextEngagement := 25.0

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}

		simTime += dt

		// Send timestamp frame
		s.emit(recordCh, fmt.Sprintf("#%.2f", simTime))

		// Check engagement trigger (simulate missile duel)
		if simTime >= nextEngagement {
			nextEngagement = simTime + 50.0 // Next combat event in 50s
			flanker := units["2001"]
			viper := units["1001"]

			if flanker != nil && flanker.alive && viper != nil && viper.alive {
				missileCounter++
				mID := fmt.Sprintf("%d", missileCounter)
				units[mID] = &simUnit{
					id:        mID,
					name:      "AIM-120C AMRAAM",
					unitType:  "Weapon+Missile",
					coalition: "Allies",
					color:     "Blue",
					country:   "us",
					pilot:     "Auto-Guided",
					lat:       viper.lat,
					lon:       viper.lon,
					alt:       viper.alt,
					speedKts:  1600, // Mach 2.4+
					heading:   acmi.CalculateBearing(viper.lat, viper.lon, flanker.lat, flanker.lon),
					alive:     true,
					isMissile: true,
					targetID:  "2001",
					lifetimeS: 18.0,
					ageS:      0,
				}

				// Spawn missile
				m := units[mID]
				s.emit(recordCh, fmt.Sprintf("%s,T=%.5f|%.5f|%.1f|0|0|%.1f,Name=%s,Type=%s,Coalition=%s,Color=%s,Pilot=%s",
					m.id, m.lon, m.lat, m.alt, m.heading, m.name, m.unitType, m.coalition, m.color, m.pilot))
			}
		}

		// Update each active unit
		for id, u := range units {
			if !u.alive {
				continue
			}

			if u.isMissile {
				u.ageS += dt
				target := units[u.targetID]
				if target != nil && target.alive {
					u.heading = acmi.CalculateBearing(u.lat, u.lon, target.lat, target.lon)
					// Guide altitude towards target
					altDiff := target.alt - u.alt
					u.alt += altDiff * 0.15
					u.pitch = math.Max(-45, math.Min(45, altDiff*0.05))

					dist := acmi.HaversineDistance(u.lat, u.lon, target.lat, target.lon)
					if dist < 300 || u.ageS >= u.lifetimeS {
						// Intercept / Impact!
						u.alive = false
						s.emit(recordCh, fmt.Sprintf("-%s", u.id)) // Despawn missile

						if dist < 600 {
							// Target destroyed!
							target.alive = false
							s.emit(recordCh, fmt.Sprintf("-%s", target.id)) // Despawn target

							// Respawn reinforcement flanker after 15 seconds
							go func(targetID string) {
								time.Sleep(15 * time.Second)
								units[targetID] = &simUnit{
									id: targetID, name: "Su-27 Flanker (CAP)", unitType: "Air+FixedWing",
									coalition: "Enemies", color: "Red", country: "ru", pilot: "Lt. Kozlov",
									lat: 42.48, lon: 42.30, alt: 7500, speedKts: 490, heading: 220,
									turnRate: -0.4, alive: true,
								}
							}(target.id)
						}
						continue
					}
				} else if u.ageS >= u.lifetimeS {
					u.alive = false
					s.emit(recordCh, fmt.Sprintf("-%s", u.id))
					continue
				}
			} else {
				// Regular unit navigation
				if u.turnRate != 0 {
					u.heading = acmi.NormalizeHeading(u.heading + u.turnRate*dt*15.0)
					u.roll = u.turnRate * 45.0 // Banking angle proportional to turn
				}
			}

			// Advance position according to heading and speed
			if u.speedKts > 0 {
				speedMS := u.speedKts * 0.514444
				distM := speedMS * dt

				// Convert distance and heading to delta lat/lon
				radH := u.heading * math.Pi / 180.0
				dLat := (distM * math.Cos(radH)) / acmi.EarthRadiusMeters * (180.0 / math.Pi)
				dLon := (distM * math.Sin(radH)) / (acmi.EarthRadiusMeters * math.Cos(u.lat*math.Pi/180.0)) * (180.0 / math.Pi)

				u.lat += dLat
				u.lon += dLon
			}

			// Emit update
			s.emit(recordCh, fmt.Sprintf("%s,T=%.5f|%.5f|%.1f|%.1f|%.1f|%.1f",
				id, u.lon, u.lat, u.alt, u.roll, u.pitch, u.heading))
		}
	}
}

func (s *SimulatorSource) emit(recordCh chan<- *acmi.ParsedRecord, line string) {
	rec, err := s.parser.ParseLine(line)
	if err == nil && rec != nil && rec.Type != acmi.RecordTypeEmpty {
		s.updateLastReceived()
		select {
		case recordCh <- rec:
		default:
		}
	}
}
