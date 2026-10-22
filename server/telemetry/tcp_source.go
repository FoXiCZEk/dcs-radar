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
)

// TCPSource connects to Tacview Real-Time Telemetry server.
type TCPSource struct {
	cfg          config.TCPSourceConfig
	parser       *acmi.Parser
	mu           sync.RWMutex
	connected    bool
	lastReceived time.Time
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

// Start initiates the TCP connection loop in the background.
func (s *TCPSource) Start(ctx context.Context) (<-chan *acmi.ParsedRecord, <-chan error) {
	recordCh := make(chan *acmi.ParsedRecord, 5000)
	errCh := make(chan error, 100)

	ctx, s.cancel = context.WithCancel(ctx)

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

func (s *TCPSource) handleConnection(ctx context.Context, conn net.Conn, recordCh chan<- *acmi.ParsedRecord) error {
	reader := bufio.NewReader(conn)
	writer := bufio.NewWriter(conn)

	// Perform Tacview RTT handshake
	// Check if server initiates with XtraLib.Stream.0
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	firstLine, err := reader.ReadString('\n')
	if err != nil {
		return fmt.Errorf("chyba při čtení úvodní hlavičky handshake: %w", err)
	}

	firstLine = strings.TrimSpace(firstLine)
	if strings.HasPrefix(firstLine, "XtraLib.Stream") {
		// Read next handshake line
		_, _ = reader.ReadString('\n') // Tacview.RealTimeTelemetry.0
		_, _ = reader.ReadString('\n') // HostName
		_, _ = reader.ReadString('\n') // Password hash

		// Respond with client handshake
		handshakeResp := fmt.Sprintf("XtraLib.Stream.0\nTacview.RealTimeTelemetry.0\n%s\n0\n", s.cfg.ClientName)
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

		_ = conn.SetReadDeadline(time.Now().Add(time.Duration(s.cfg.TimeoutSec*2) * time.Second))
		line, err := reader.ReadString('\n')
		if err != nil {
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
