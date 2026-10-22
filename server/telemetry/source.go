package telemetry

import (
	"context"
	"time"

	"dcs-radar/acmi"
)

// Source represents an abstraction over any telemetry data stream.
type Source interface {
	// Start begins streaming records over the returned channel.
	Start(ctx context.Context) (<-chan *acmi.ParsedRecord, <-chan error)
	// Stop halts the telemetry stream and releases underlying network or file resources.
	Stop() error
	// Type returns the source identifier ("tcp", "file", "simulator").
	Type() string
	// IsConnected returns whether the source is actively receiving data.
	IsConnected() bool
	// LastReceived returns the timestamp of the most recent data record.
	LastReceived() time.Time
}
