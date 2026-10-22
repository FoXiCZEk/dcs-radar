package telemetry

import (
	"context"
	"testing"
	"time"

	"dcs-radar/config"
)

func TestSimulatorSource(t *testing.T) {
	cfg := config.SimulatorConfig{
		UpdateRateHz: 10.0,
		Scenario:     "caucasus_dogfight",
	}

	sim := NewSimulatorSource(cfg)
	if sim.Type() != "simulator" {
		t.Errorf("expected type 'simulator', got %s", sim.Type())
	}

	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	recCh, errCh := sim.Start(ctx)

	receivedCount := 0
	for {
		select {
		case <-ctx.Done():
			goto done
		case err := <-errCh:
			t.Fatalf("simulator emitted error: %v", err)
		case rec := <-recCh:
			if rec != nil {
				receivedCount++
			}
		}
	}
done:
	_ = sim.Stop()

	if receivedCount < 5 {
		t.Errorf("expected at least 5 records from simulator, got %d", receivedCount)
	}
	if !sim.LastReceived().After(time.Time{}) {
		t.Errorf("expected valid LastReceived timestamp")
	}
}
