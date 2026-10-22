package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"dcs-radar/acmi"
	"dcs-radar/api"
	"dcs-radar/config"
	"dcs-radar/history"
	"dcs-radar/models"
	"dcs-radar/state"
	"dcs-radar/telemetry"
)

func main() {
	configPath := flag.String("config", "config.yaml", "Cesta ke konfiguračnímu YAML souboru")
	flag.Parse()

	log.Println("==================================================")
	log.Println("        DCS Radar - Realtime Telemetry Server     ")
	log.Println("==================================================")

	// 1. Load configuration
	cfg, err := config.LoadConfig(*configPath)
	if err != nil {
		log.Printf("[Varování] Nelze načíst '%s' (%v), použity výchozí hodnoty", *configPath, err)
		cfg = config.DefaultConfig()
	} else {
		log.Printf("[Konfigurace] Úspěšně načtena z %s", *configPath)
	}

	// 2. Initialize subsystems
	eventEngine := state.NewEventEngine(1000)
	stateManager := state.NewManager(cfg.History.TrailMaxPoints, eventEngine)

	historyStore, err := history.NewStore(cfg.History.DBPath)
	if err != nil {
		log.Fatalf("[Chyba] Inicializace úložiště historie selhala: %v", err)
	}
	defer historyStore.Close()

	// 3. Start retention background worker
	retentionWorker := history.NewRetentionWorker(historyStore, cfg.History)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	retentionWorker.Start(ctx)

	// 4. Initialize telemetry source
	var source telemetry.Source
	switch cfg.Telemetry.Type {
	case "tcp":
		log.Printf("[Telemetrie] Vybrán TCP zdroj (Tacview RTT na %s:%d)", cfg.Telemetry.TCP.Host, cfg.Telemetry.TCP.Port)
		source = telemetry.NewTCPSource(cfg.Telemetry.TCP)
	case "file":
		log.Printf("[Telemetrie] Vybrán souborový zdroj (%s)", cfg.Telemetry.File.Path)
		source = telemetry.NewFileSource(cfg.Telemetry.File)
	case "simulator":
		log.Printf("[Telemetrie] Spuštěn interní simulátor DCS (Kavkaz)")
		source = telemetry.NewSimulatorSource(cfg.Telemetry.Simulator)
	default:
		log.Fatalf("[Chyba] Neznámý typ telemetrie: %s", cfg.Telemetry.Type)
	}

	// 5. Initialize Web Server and WebSocket Hub
	server := api.NewServer(cfg, stateManager, historyStore, source)
	hub := server.WebSocketHub()

	// 6. Start telemetry ingestion
	recordCh, errCh := source.Start(ctx)

	go func() {
		for err := range errCh {
			log.Printf("[Telemetrie Chyba] %v", err)
		}
	}()

	// Ingestion processor: applies records, saves to history, broadcasts to WebSocket
	go processTelemetry(ctx, recordCh, stateManager, historyStore, hub)

	// 7. Start HTTP / WebSocket server
	go func() {
		if err := server.Start(); err != nil {
			log.Printf("[Server] Ukončen: %v", err)
		}
	}()

	// 8. Graceful shutdown handler
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	sig := <-sigCh
	log.Printf("[Systém] Přijat signál k ukončení (%v), probíhá bezpečné zastavení...", sig)

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	retentionWorker.Stop()
	_ = source.Stop()
	_ = server.Shutdown(shutdownCtx)

	log.Println("[Systém] DCS Radar úspěšně ukončen.")
}

func processTelemetry(
	ctx context.Context,
	recordCh <-chan *acmi.ParsedRecord,
	sm *state.Manager,
	hs *history.Store,
	hub *api.WebSocketHub,
) {
	// Delta batching at 10 Hz for smooth rendering without flooding clients
	batchTicker := time.NewTicker(100 * time.Millisecond)
	defer batchTicker.Stop()

	var updatedObjects []*models.Object
	var generatedEvents []*models.Event
	var lastOffset float64

	for {
		select {
		case <-ctx.Done():
			return

		case rec, ok := <-recordCh:
			if !ok {
				return
			}
			lastOffset = rec.TimeOffset

			obj, ev := sm.ApplyRecord(rec)
			if obj != nil {
				updatedObjects = append(updatedObjects, obj)
				_ = hs.SaveSample(obj)
			}
			if ev != nil {
				generatedEvents = append(generatedEvents, ev)
				_ = hs.SaveEvent(ev)
			}

		case <-batchTicker.C:
			if len(updatedObjects) > 0 || len(generatedEvents) > 0 {
				hub.BroadcastDelta(updatedObjects, generatedEvents, time.Now().UTC(), lastOffset)
				updatedObjects = nil
				generatedEvents = nil
			}
		}
	}
}
