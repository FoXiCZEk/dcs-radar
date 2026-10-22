package telemetry

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"net"
	"strings"
	"sync"
	"time"

	"dcs-radar/acmi"
	"dcs-radar/config"
	"dcs-radar/models"
)

// TCPSource connects to Tacview Real-Time Telemetry server.
type TCPSource struct {
	cfg          config.TCPSourceConfig
	parser       *acmi.Parser
	mu           sync.RWMutex
	connected    bool
	lastReceived time.Time
	lastHealth   models.DCSHealthStatus
	cancel       context.CancelFunc
	done         chan struct{}
}

// NewTCPSource creates a new TCP telemetry client.
func NewTCPSource(cfg config.TCPSourceConfig) *TCPSource {
	if cfg.ClientName == "" {
		cfg.ClientName = "DCS-Radar"
	}
	if cfg.ReconnectIntervalSec <= 0 {
		cfg.ReconnectIntervalSec = 5
	}
	if cfg.TimeoutSec <= 0 {
		cfg.TimeoutSec = 10
	}

	return &TCPSource{
		cfg:    cfg,
		parser: acmi.NewParser(),
		done:   make(chan struct{}),
	}
}

func (s *TCPSource) Type() string {
	return "tcp"
}

func (s *TCPSource) IsConnected() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.connected
}

func (s *TCPSource) LastReceived() time.Time {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastReceived
}

func (s *TCPSource) setConnected(c bool) {
	s.mu.Lock()
	s.connected = c
	s.mu.Unlock()
}

func (s *TCPSource) updateLastReceived() {
	s.mu.Lock()
	s.lastReceived = time.Now().UTC()
	s.mu.Unlock()
}

// ProbeHealth actively tests DCS network ports (Tacview 42674, Game Port 10308, and gRPC 40051).
func (s *TCPSource) ProbeHealth() models.DCSHealthStatus {
	gamePort := s.cfg.GamePort
	if gamePort <= 0 {
		gamePort = 10308
	}
	grpcPort := s.cfg.GRPCPort
	if grpcPort <= 0 {
		grpcPort = 40051
	}

	tacviewOpen := s.IsConnected()
	if !tacviewOpen {
		conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", s.cfg.Host, s.cfg.Port), 1500*time.Millisecond)
		if err == nil {
			tacviewOpen = true
			_ = conn.Close()
		}
	}

	// Probe game port (DCS default game port 10308)
	gamePortOpen := false
	gameConn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", s.cfg.Host, gamePort), 1500*time.Millisecond)
	if err == nil {
		gamePortOpen = true
		_ = gameConn.Close()
	}

	// Probe gRPC port (DCS-gRPC port 40051)
	grpcPortOpen := false
	grpcConn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", s.cfg.Host, grpcPort), 1500*time.Millisecond)
	if err == nil {
		grpcPortOpen = true
		_ = grpcConn.Close()
	}

	state := "offline"
	msg := fmt.Sprintf("DCS Server na %s neposlouchá (offline).", s.cfg.Host)

	lastRecv := s.LastReceived()
	isReceiving := !lastRecv.IsZero() && time.Since(lastRecv) < 15*time.Second

	if isReceiving {
		state = "connected"
		msg = "DCS Server je aktivní a vysílá realtime telemetrii."
	} else if gamePortOpen || grpcPortOpen || tacviewOpen {
		state = "paused"
		if tacviewOpen {
			msg = fmt.Sprintf("DCS Server běží (spojení s Tacview %d aktivní), ale mise je pozastavena.", s.cfg.Port)
		} else {
			msg = fmt.Sprintf("DCS Server běží (herní port %d / gRPC %d aktivní), ale Tacview port %d neposlouchá. Mise může být pozastavena.", gamePort, grpcPort, s.cfg.Port)
		}
	}

	status := models.DCSHealthStatus{
		TacviewPortOpen: tacviewOpen,
		GamePortOpen:    gamePortOpen,
		GRPCPortOpen:    grpcPortOpen,
		State:           state,
		Message:         msg,
		Host:            s.cfg.Host,
		TacviewPort:     s.cfg.Port,
		GamePort:        gamePort,
		GRPCPort:        grpcPort,
	}

	s.mu.Lock()
	s.lastHealth = status
	s.mu.Unlock()

	return status
}

// GetDCSHealth returns the cached DCS server health status.
func (s *TCPSource) GetDCSHealth() *models.DCSHealthStatus {
	s.mu.RLock()
	h := s.lastHealth
	s.mu.RUnlock()
	if h.Host == "" {
		res := s.ProbeHealth()
		return &res
	}
	return &h
}

// Start initiates the TCP connection loop in the background.
func (s *TCPSource) Start(ctx context.Context) (<-chan *acmi.ParsedRecord, <-chan error) {
	recordCh := make(chan *acmi.ParsedRecord, 5000)
	errCh := make(chan error, 100)

	ctx, s.cancel = context.WithCancel(ctx)

	// Initial immediate health probe
	go s.ProbeHealth()

	// Periodic health probe
	go func() {
		ticker := time.NewTicker(6 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				s.ProbeHealth()
			case <-ctx.Done():
				return
			}
		}
	}()

	go s.runConnectionLoop(ctx, recordCh, errCh)

	return recordCh, errCh
}

// Stop cleanly disconnects and stops the TCP client.
func (s *TCPSource) Stop() error {
	if s.cancel != nil {
		s.cancel()
	}
	close(s.done)
	s.setConnected(false)
	return nil
}

func (s *TCPSource) runConnectionLoop(ctx context.Context, recordCh chan<- *acmi.ParsedRecord, errCh chan<- error) {
	addr := fmt.Sprintf("%s:%d", s.cfg.Host, s.cfg.Port)

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		s.ProbeHealth()
		log.Printf("[TCP Source] Připojování k Tacview exporteru na %s...", addr)
		conn, err := net.DialTimeout("tcp", addr, time.Duration(s.cfg.TimeoutSec)*time.Second)
		if err != nil {
			s.setConnected(false)
			select {
			case errCh <- fmt.Errorf("připojení k %s selhalo: %w", addr, err):
			default:
			}
			select {
			case <-time.After(time.Duration(s.cfg.ReconnectIntervalSec) * time.Second):
				continue
			case <-ctx.Done():
				return
			}
		}

		log.Printf("[TCP Source] Spojení s %s úspěšně navázáno, probíhá handshake...", addr)
		s.setConnected(true)

		err = s.handleConnection(ctx, conn, recordCh)
		conn.Close()
		s.setConnected(false)
		s.ProbeHealth()

		if err != nil && ctx.Err() == nil {
			log.Printf("[TCP Source] Spojení ukončeno (%v), opětovné připojení za %d s...", err, s.cfg.ReconnectIntervalSec)
			select {
			case errCh <- err:
			default:
			}
		}

		select {
		case <-time.After(time.Duration(s.cfg.ReconnectIntervalSec) * time.Second):
		case <-ctx.Done():
			return
		}
	}
}

// readHandshakeToken reads bytes until \n or \0 or EOF.
func readHandshakeToken(r *bufio.Reader) (string, error) {
	var buf []byte
	for {
		b, err := r.ReadByte()
		if err != nil {
			if len(buf) > 0 {
				return string(buf), nil
			}
			return "", err
		}
		if b == '\n' || b == 0 {
			break
		}
		if b != '\r' {
			buf = append(buf, b)
		}
	}
	return string(buf), nil
}

func (s *TCPSource) handleConnection(ctx context.Context, conn net.Conn, recordCh chan<- *acmi.ParsedRecord) error {
	reader := bufio.NewReader(conn)
	writer := bufio.NewWriter(conn)

	// Perform Tacview RTT handshake
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	firstLine, err := readHandshakeToken(reader)
	if err != nil {
		return fmt.Errorf("chyba při čtení úvodní hlavičky handshake: %w", err)
	}

	firstLine = strings.TrimSpace(firstLine)
	if strings.HasPrefix(firstLine, "XtraLib.Stream") {
		// Read next handshake tokens
		_, _ = readHandshakeToken(reader) // Tacview.RealTimeTelemetry.0
		_, _ = readHandshakeToken(reader) // HostName
		_, _ = readHandshakeToken(reader) // Password hash / null terminator

		// Respond with client handshake terminated by null byte \x00
		handshakeResp := fmt.Sprintf("XtraLib.Stream.0\nTacview.RealTimeTelemetry.0\n%s\n0\x00", s.cfg.ClientName)
		if _, err := writer.WriteString(handshakeResp); err != nil {
			return fmt.Errorf("chyba při odesílání klientského handshake: %w", err)
		}
		if err := writer.Flush(); err != nil {
			return fmt.Errorf("chyba při flush handshake: %w", err)
		}
		log.Printf("[TCP Source] Tacview RTT handshake úspěšně dokončen.")
	} else {
		// Server directly began streaming ACMI data, process first line
		rec, pErr := s.parser.ParseLine(firstLine)
		if pErr == nil && rec != nil && rec.Type != acmi.RecordTypeEmpty {
			s.updateLastReceived()
			recordCh <- rec
		}
	}

	// Main telemetry receive loop
	for {
		select {
		case <-ctx.Done():
			return nil
		default:
		}

		// When mission is paused, Tacview can stay quiet for extended periods.
		// Use a 20s read deadline to verify socket health without tearing down the connection.
		_ = conn.SetReadDeadline(time.Now().Add(20 * time.Second))
		line, err := reader.ReadString('\n')
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				// Socket is still connected, but idle (likely paused DCS mission)
				s.ProbeHealth()
				continue
			}
			return fmt.Errorf("spojení přerušeno: %w", err)
		}

		rec, err := s.parser.ParseLine(line)
		if err != nil {
			// Do not drop entire stream on single malformed line
			continue
		}

		if rec != nil && rec.Type != acmi.RecordTypeEmpty && rec.Type != acmi.RecordTypeComment {
			s.updateLastReceived()
			select {
			case recordCh <- rec:
			default:
				// Channel full, drop oldest or log to avoid blocking telemetry reader
			}
		}
	}
}
