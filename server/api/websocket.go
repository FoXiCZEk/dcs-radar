package api

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"dcs-radar/models"
	"dcs-radar/state"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Configured via CORS middleware or allowed origins
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 4096,
}

// Client represents a connected browser session.
type Client struct {
	hub  *WebSocketHub
	conn *websocket.Conn
	send chan []byte
}

// WSMessage represents the outer envelope sent over WebSocket.
type WSMessage struct {
	Type          string           `json:"type"` // "snapshot", "delta", "ping"
	Timestamp     time.Time        `json:"timestamp"`
	TimeOffset    float64          `json:"timeOffset,omitempty"`
	ReferenceTime time.Time        `json:"referenceTime,omitempty"`
	Objects       []*models.Object `json:"objects,omitempty"`
	Events        []*models.Event  `json:"events,omitempty"`
}

// WebSocketHub manages real-time broadcast to all connected web clients.
type WebSocketHub struct {
	stateManager *state.Manager
	clients      map[*Client]bool
	broadcast    chan []byte
	register     chan *Client
	unregister   chan *Client
	mu           sync.RWMutex
}

// NewWebSocketHub creates a WebSocket hub.
func NewWebSocketHub(sm *state.Manager) *WebSocketHub {
	return &WebSocketHub{
		stateManager: sm,
		clients:      make(map[*Client]bool),
		broadcast:    make(chan []byte, 1024),
		register:     make(chan *Client),
		unregister:   make(chan *Client),
	}
}

// Run begins the hub event loop.
func (h *WebSocketHub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("[WebSocket] Nový klient připojen (%d aktivních)", h.ClientCount())

			// Send immediate full snapshot on connect
			h.sendSnapshot(client)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("[WebSocket] Klient odpojen (%d aktivních)", h.ClientCount())

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					// Slow client protection: Drop packet to avoid blocking server or other clients
				}
			}
			h.mu.RUnlock()
		}
	}
}

// ClientCount returns the number of currently connected clients.
func (h *WebSocketHub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

func (h *WebSocketHub) sendSnapshot(client *Client) {
	objects := h.stateManager.GetActiveObjects()
	events := h.stateManager.EventEngine().GetEvents(50, "", "")

	msg := WSMessage{
		Type:          "snapshot",
		Timestamp:     time.Now().UTC(),
		ReferenceTime: h.stateManager.ReferenceTime(),
		Objects:       objects,
		Events:        events,
	}

	data, err := json.Marshal(msg)
	if err == nil {
		select {
		case client.send <- data:
		default:
		}
	}
}

// BroadcastDelta sends updated objects and events to all connected clients.
func (h *WebSocketHub) BroadcastDelta(objects []*models.Object, events []*models.Event, t time.Time, offset float64) {
	if len(objects) == 0 && len(events) == 0 {
		return
	}

	msg := WSMessage{
		Type:       "delta",
		Timestamp:  t,
		TimeOffset: offset,
		Objects:    objects,
		Events:     events,
	}

	data, err := json.Marshal(msg)
	if err == nil {
		select {
		case h.broadcast <- data:
		default:
		}
	}
}

// HandleWS upgrades HTTP to WebSocket connection.
func (h *WebSocketHub) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WebSocket] Upgrade selhal: %v", err)
		return
	}

	client := &Client{
		hub:  h,
		conn: conn,
		send: make(chan []byte, 256),
	}

	h.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(4096)
	_ = c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		_ = c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(25 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			_, _ = w.Write(message)
			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
