package api

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"dcs-radar/config"
	"dcs-radar/history"
	"dcs-radar/state"
	"dcs-radar/telemetry"
)

// Server coordinates HTTP API, WebSocket, and static frontend hosting.
type Server struct {
	cfg          *config.Config
	stateManager *state.Manager
	historyStore *history.Store
	source       telemetry.Source
	hub          *WebSocketHub
	httpServer   *http.Server
	apiHandler   *APIHandler
}

// NewServer creates a new HTTP & WebSocket server.
func NewServer(cfg *config.Config, sm *state.Manager, hs *history.Store, src telemetry.Source) *Server {
	hub := NewWebSocketHub(sm)
	apiHandler := NewAPIHandler(cfg, sm, hs, src)

	s := &Server{
		cfg:          cfg,
		stateManager: sm,
		historyStore: hs,
		source:       src,
		hub:          hub,
		apiHandler:   apiHandler,
	}

	mux := http.NewServeMux()
	s.registerRoutes(mux)

	handler := s.applyMiddleware(mux)

	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	s.httpServer = &http.Server{
		Addr:         addr,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	return s
}

// WebSocketHub returns the underlying hub for broadcasting deltas.
func (s *Server) WebSocketHub() *WebSocketHub {
	return s.hub
}

func (s *Server) registerRoutes(mux *http.ServeMux) {
	// WebSocket
	mux.HandleFunc("/ws", s.hub.HandleWS)

	// REST API v1
	mux.HandleFunc("/api/v1/health", s.apiHandler.HealthCheck)
	mux.HandleFunc("/api/v1/ready", s.apiHandler.ReadinessCheck)
	mux.HandleFunc("/api/v1/status", s.apiHandler.GetStatus)
	mux.HandleFunc("/api/v1/objects", s.apiHandler.GetObjects)
	mux.HandleFunc("/api/v1/objects/", s.apiHandler.GetObjectDetail)
	mux.HandleFunc("/api/v1/history/range", s.apiHandler.GetHistoryRange)
	mux.HandleFunc("/api/v1/history/snapshot", s.apiHandler.GetHistorySnapshot)
	mux.HandleFunc("/api/v1/history/export", s.apiHandler.ExportHistory)
	mux.HandleFunc("/api/v1/events", s.apiHandler.GetEvents)
	mux.HandleFunc("/api/v1/config", s.apiHandler.GetPublicConfig)

	// Static SPA Frontend Handler
	staticDir := s.findWebDistDir()
	if staticDir != "" {
		log.Printf("[Server] Servírování frontendu z adresáře: %s", staticDir)
		fileServer := http.FileServer(http.Dir(staticDir))
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/ws" {
				return
			}
			// Check if file exists, otherwise serve index.html for SPA routing
			path := filepath.Join(staticDir, filepath.Clean(r.URL.Path))
			if info, err := os.Stat(path); err != nil || info.IsDir() {
				http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
				return
			}
			fileServer.ServeHTTP(w, r)
		})
	} else {
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/ws" {
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write([]byte(`<!DOCTYPE html><html><head><title>DCS Radar</title></head>
			<body style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem;">
				<h1>DCS Radar Backend je aktivní</h1>
				<p>REST API a WebSocket (/ws) jsou připraveny.</p>
				<p>Pro zobrazení frontendu spusťte vývojový server nebo sestavte frontend (<code>npm run build</code>).</p>
				<ul>
					<li><a style="color: #38bdf8;" href="/api/v1/status">/api/v1/status</a></li>
					<li><a style="color: #38bdf8;" href="/api/v1/objects">/api/v1/objects</a></li>
					<li><a style="color: #38bdf8;" href="/api/v1/events">/api/v1/events</a></li>
				</ul>
			</body></html>`))
		})
	}
}

func (s *Server) findWebDistDir() string {
	candidates := []string{
		"./web/dist",
		"../web/dist",
		"./dist",
		"/app/web/dist",
	}
	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && fi.IsDir() {
			if _, err := os.Stat(filepath.Join(c, "index.html")); err == nil {
				return c
			}
		}
	}
	return ""
}

func (s *Server) applyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// CORS Headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Auth check if enabled
		if s.cfg.Server.AuthEnabled && strings.HasPrefix(r.URL.Path, "/api/") {
			token := r.Header.Get("Authorization")
			token = strings.TrimPrefix(token, "Bearer ")
			if token != s.cfg.Server.AuthToken {
				http.Error(w, `{"error":"Neautorizovaný přístup"}`, http.StatusUnauthorized)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

// Start launches the WebSocket hub and HTTP server.
func (s *Server) Start() error {
	go s.hub.Run()
	log.Printf("[Server] DCS Radar server naslouchá na http://%s", s.httpServer.Addr)
	if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

// Shutdown gracefully terminates the server.
func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}
