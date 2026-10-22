package history

import (
	"context"
	"log"
	"time"

	"dcs-radar/config"
)

// RetentionWorker runs in the background and enforces retention limits.
type RetentionWorker struct {
	store    *Store
	cfg      config.HistoryConfig
	cancel   context.CancelFunc
}

// NewRetentionWorker creates a retention manager.
func NewRetentionWorker(store *Store, cfg config.HistoryConfig) *RetentionWorker {
	if cfg.RetentionMinutes <= 0 {
		cfg.RetentionMinutes = 60
	}
	if cfg.CleanupIntervalSec <= 0 {
		cfg.CleanupIntervalSec = 60
	}
	return &RetentionWorker{
		store: store,
		cfg:   cfg,
	}
}

// Start initiates periodic pruning.
func (w *RetentionWorker) Start(ctx context.Context) {
	ctx, w.cancel = context.WithCancel(ctx)
	go w.run(ctx)
}

// Stop stops the retention worker.
func (w *RetentionWorker) Stop() {
	if w.cancel != nil {
		w.cancel()
	}
}

func (w *RetentionWorker) run(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(w.cfg.CleanupIntervalSec) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			cutoff := time.Now().UTC().Add(-time.Duration(w.cfg.RetentionMinutes) * time.Minute)
			deleted, err := w.store.PruneOlderThan(cutoff)
			if err != nil {
				log.Printf("[Retention] Chyba při čištění staré historie: %v", err)
			} else if deleted > 0 {
				log.Printf("[Retention] Automaticky odstraněno %d vzorků starších než %d minut", deleted, w.cfg.RetentionMinutes)
			}
		}
	}
}
