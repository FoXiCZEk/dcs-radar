package telemetry

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"dcs-radar/acmi"
	"dcs-radar/config"
)

// FileSource reads telemetry by continuously tailing an active ACMI file.
type FileSource struct {
	cfg          config.FileSourceConfig
	parser       *acmi.Parser
	mu           sync.RWMutex
	connected    bool
	lastReceived time.Time
	currentFile  string
	cancel       context.CancelFunc
}

// NewFileSource creates a new file tailer source.
func NewFileSource(cfg config.FileSourceConfig) *FileSource {
	if cfg.PollIntervalMs <= 0 {
		cfg.PollIntervalMs = 250
	}
	return &FileSource{
		cfg:    cfg,
		parser: acmi.NewParser(),
	}
}

func (s *FileSource) Type() string {
	return "file"
}

func (s *FileSource) IsConnected() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.connected
}

func (s *FileSource) LastReceived() time.Time {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastReceived
}

func (s *FileSource) setConnected(c bool) {
	s.mu.Lock()
	s.connected = c
	s.mu.Unlock()
}

func (s *FileSource) updateLastReceived() {
	s.mu.Lock()
	s.lastReceived = time.Now().UTC()
	s.mu.Unlock()
}

// Start begins the continuous file tailing loop.
func (s *FileSource) Start(ctx context.Context) (<-chan *acmi.ParsedRecord, <-chan error) {
	recordCh := make(chan *acmi.ParsedRecord, 5000)
	errCh := make(chan error, 100)

	ctx, s.cancel = context.WithCancel(ctx)
	go s.runTailLoop(ctx, recordCh, errCh)

	return recordCh, errCh
}

// Stop halts file reading.
func (s *FileSource) Stop() error {
	if s.cancel != nil {
		s.cancel()
	}
	s.setConnected(false)
	return nil
}

func (s *FileSource) findTargetFile() (string, error) {
	if s.cfg.AutoDetectLatest && s.cfg.Directory != "" {
		entries, err := os.ReadDir(s.cfg.Directory)
		if err != nil {
			return "", err
		}

		type fileInfo struct {
			path    string
			modTime time.Time
		}
		var acmiFiles []fileInfo

		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			name := entry.Name()
			if strings.HasSuffix(name, ".txt.acmi") || strings.HasSuffix(name, ".acmi") {
				fullPath := filepath.Join(s.cfg.Directory, name)
				info, err := entry.Info()
				if err == nil {
					acmiFiles = append(acmiFiles, fileInfo{path: fullPath, modTime: info.ModTime()})
				}
			}
		}

		if len(acmiFiles) > 0 {
			sort.Slice(acmiFiles, func(i, j int) bool {
				return acmiFiles[i].modTime.After(acmiFiles[j].modTime)
			})
			return acmiFiles[0].path, nil
		}
	}

	if s.cfg.Path != "" {
		return s.cfg.Path, nil
	}

	return "", fmt.Errorf("žádný platný ACMI soubor nebyl nalezen")
}

func (s *FileSource) runTailLoop(ctx context.Context, recordCh chan<- *acmi.ParsedRecord, errCh chan<- error) {
	pollInterval := time.Duration(s.cfg.PollIntervalMs) * time.Millisecond

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		filePath, err := s.findTargetFile()
		if err != nil {
			s.setConnected(false)
			select {
			case <-time.After(2 * time.Second):
				continue
			case <-ctx.Done():
				return
			}
		}

		s.currentFile = filePath
		log.Printf("[File Source] Otevírání ACMI souboru: %s", filePath)

		file, err := os.Open(filePath)
		if err != nil {
			s.setConnected(false)
			select {
			case errCh <- fmt.Errorf("nelze otevřít soubor %s: %w", filePath, err):
			default:
			}
			select {
			case <-time.After(2 * time.Second):
				continue
			case <-ctx.Done():
				return
			}
		}

		s.setConnected(true)
		s.tailFile(ctx, file, recordCh)
		file.Close()
		s.setConnected(false)

		select {
		case <-time.After(pollInterval):
		case <-ctx.Done():
			return
		}
	}
}

func (s *FileSource) tailFile(ctx context.Context, file *os.File, recordCh chan<- *acmi.ParsedRecord) {
	reader := bufio.NewReader(file)
	pollInterval := time.Duration(s.cfg.PollIntervalMs) * time.Millisecond

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				// Reached end of file, wait for DCS to write more
				time.Sleep(pollInterval)

				// Check if file was rotated or truncated
				fi, statErr := file.Stat()
				if statErr != nil {
					return
				}
				offset, seekErr := file.Seek(0, io.SeekCurrent)
				if seekErr == nil && fi.Size() < offset {
					log.Printf("[File Source] Detekováno zkrácení/rotace souboru %s, resetování pozice...", s.currentFile)
					_, _ = file.Seek(0, io.SeekStart)
					reader.Reset(file)
					s.parser = acmi.NewParser()
				}
				continue
			}
			return
		}

		rec, pErr := s.parser.ParseLine(line)
		if pErr == nil && rec != nil && rec.Type != acmi.RecordTypeEmpty && rec.Type != acmi.RecordTypeComment {
			s.updateLastReceived()
			select {
			case recordCh <- rec:
			default:
			}
		}
	}
}
