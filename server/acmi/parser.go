package acmi

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"dcs-radar/models"
)

// RecordType identifies the parsed ACMI line category.
type RecordType string

const (
	RecordTypeHeader    RecordType = "Header"
	RecordTypeTimestamp RecordType = "Timestamp"
	RecordTypeUpdate    RecordType = "Update"
	RecordTypeDelete    RecordType = "Delete"
	RecordTypeGlobal    RecordType = "Global"
	RecordTypeComment   RecordType = "Comment"
	RecordTypeEmpty     RecordType = "Empty"
)

// ParsedRecord contains the result of parsing a single ACMI line.
type ParsedRecord struct {
	Type             RecordType
	TimeOffset       float64
	Timestamp        time.Time
	ObjectID         string
	Object           *models.Object
	GlobalProperties map[string]string
	RawLine          string
}

// Parser manages streaming ACMI state.
type Parser struct {
	ReferenceTime     time.Time
	CurrentTimeOffset float64
	FileVersion       string
	objects           map[string]*models.Object
}

// NewParser creates an ACMI parser with default reference time set to UTC now.
func NewParser() *Parser {
	return &Parser{
		ReferenceTime: time.Now().UTC(),
		objects:       make(map[string]*models.Object),
	}
}

// SetReferenceTime updates the base mission time.
func (p *Parser) SetReferenceTime(t time.Time) {
	p.ReferenceTime = t
}

// CurrentAbsoluteTime returns the current reconstructed UTC time.
func (p *Parser) CurrentAbsoluteTime() time.Time {
	return p.ReferenceTime.Add(time.Duration(p.CurrentTimeOffset * float64(time.Second)))
}

// ParseLine processes a single line from an ACMI stream or file.
func (p *Parser) ParseLine(line string) (*ParsedRecord, error) {
	line = strings.TrimRight(line, "\r\n")
	trimmed := strings.TrimSpace(line)

	if trimmed == "" {
		return &ParsedRecord{Type: RecordTypeEmpty, RawLine: line}, nil
	}

	// Comment line
	if strings.HasPrefix(trimmed, "//") {
		return &ParsedRecord{Type: RecordTypeComment, RawLine: line}, nil
	}

	// Header line
	if strings.HasPrefix(trimmed, "FileType=") {
		return &ParsedRecord{Type: RecordTypeHeader, RawLine: line}, nil
	}
	if strings.HasPrefix(trimmed, "FileVersion=") {
		p.FileVersion = strings.TrimPrefix(trimmed, "FileVersion=")
		return &ParsedRecord{Type: RecordTypeHeader, RawLine: line}, nil
	}

	// Timestamp frame: #<seconds>
	if strings.HasPrefix(trimmed, "#") {
		secStr := strings.TrimPrefix(trimmed, "#")
		offset, err := strconv.ParseFloat(secStr, 64)
		if err != nil {
			return nil, fmt.Errorf("neplatná časová značka '%s': %w", trimmed, err)
		}
		p.CurrentTimeOffset = offset
		return &ParsedRecord{
			Type:       RecordTypeTimestamp,
			TimeOffset: offset,
			Timestamp:  p.CurrentAbsoluteTime(),
			RawLine:    line,
		}, nil
	}

	// Object deletion: -<hex_id>
	if strings.HasPrefix(trimmed, "-") {
		id := strings.TrimPrefix(trimmed, "-")
		id = strings.TrimSpace(id)
		delete(p.objects, id)
		return &ParsedRecord{
			Type:       RecordTypeDelete,
			TimeOffset: p.CurrentTimeOffset,
			Timestamp:  p.CurrentAbsoluteTime(),
			ObjectID:   id,
			RawLine:    line,
		}, nil
	}

	// Object update or Global properties (ID=0)
	// Example: 1001,T=41.5|42.1|3000,Name=F-16C,Type=Air+FixedWing
	// Values may have escaped commas: \,
	firstComma := strings.Index(trimmed, ",")
	if firstComma == -1 {
		// Line without comma, might be standalone ID or unknown token
		return &ParsedRecord{Type: RecordTypeEmpty, RawLine: line}, nil
	}

	id := strings.TrimSpace(trimmed[:firstComma])
	propsStr := trimmed[firstComma+1:]

	props := splitProperties(propsStr)

	// Global properties (ID == "0")
	if id == "0" {
		if refTimeStr, ok := props["ReferenceTime"]; ok {
			// Tacview uses ISO 8601: e.g. 2026-10-22T10:00:00Z
			parsedTime, err := parseTacviewTime(refTimeStr)
			if err == nil {
				p.ReferenceTime = parsedTime
			}
		}
		return &ParsedRecord{
			Type:             RecordTypeGlobal,
			TimeOffset:       p.CurrentTimeOffset,
			Timestamp:        p.CurrentAbsoluteTime(),
			ObjectID:         "0",
			GlobalProperties: props,
			RawLine:          line,
		}, nil
	}

	// Normal tracked object
	obj, exists := p.objects[id]
	if !exists {
		obj = &models.Object{
			ID:         id,
			FirstSeen:  p.CurrentAbsoluteTime(),
			Alive:      true,
			Properties: make(map[string]string),
		}
		p.objects[id] = obj
	}

	obj.LastSeen = p.CurrentAbsoluteTime()
	obj.Alive = true

	// Apply properties
	for k, v := range props {
		obj.Properties[k] = v
		switch k {
		case "Name":
			obj.Name = v
		case "Type":
			obj.Type = v
			obj.Category = models.ResolveCategory(v)
		case "Coalition":
			obj.Coalition = models.ResolveCoalition(v, obj.Color)
		case "Color":
			obj.Color = v
			if obj.Coalition == models.CoalitionUnknown {
				obj.Coalition = models.ResolveCoalition(obj.Properties["Coalition"], v)
			}
		case "Country":
			obj.Country = v
		case "Pilot":
			obj.Pilot = v
		case "Callsign":
			obj.Callsign = v
		case "Group":
			obj.Group = v
		case "Squawk":
			obj.Squawk = v
		case "IAS":
			if val, err := strconv.ParseFloat(v, 64); err == nil {
				obj.IAS = val
			}
		case "TAS":
			if val, err := strconv.ParseFloat(v, 64); err == nil {
				obj.TAS = val
			}
		case "Mach":
			if val, err := strconv.ParseFloat(v, 64); err == nil {
				obj.Mach = val
			}
		case "AOA":
			if val, err := strconv.ParseFloat(v, 64); err == nil {
				obj.AOA = val
			}
		}
	}

	// Parse transform if present
	if tStr, ok := props["T"]; ok {
		var prevTransform *models.Transform
		if obj.CurrentTransform.Timestamp.After(time.Time{}) {
			prev := obj.CurrentTransform
			prevTransform = &prev
		}

		transform, ok := ParseTransform(tStr, prevTransform, p.CurrentTimeOffset, p.ReferenceTime)
		if ok {
			obj.CurrentTransform = transform
		}
	}

	// If Coalition is still unknown, default check
	if obj.Coalition == models.CoalitionUnknown {
		obj.Coalition = models.ResolveCoalition(obj.Properties["Coalition"], obj.Color)
	}
	if obj.Category == "" {
		obj.Category = models.ResolveCategory(obj.Type)
	}

	// Clone object for safety
	objCopy := *obj
	return &ParsedRecord{
		Type:       RecordTypeUpdate,
		TimeOffset: p.CurrentTimeOffset,
		Timestamp:  p.CurrentAbsoluteTime(),
		ObjectID:   id,
		Object:     &objCopy,
		RawLine:    line,
	}, nil
}

// splitProperties splits key=value pairs taking escaped commas into account.
func splitProperties(str string) map[string]string {
	result := make(map[string]string)
	var current strings.Builder
	var tokens []string

	escaped := false
	for _, r := range str {
		if escaped {
			current.WriteRune(r)
			escaped = false
		} else if r == '\\' {
			escaped = true
		} else if r == ',' {
			tokens = append(tokens, current.String())
			current.Reset()
		} else {
			current.WriteRune(r)
		}
	}
	if current.Len() > 0 || len(tokens) > 0 {
		tokens = append(tokens, current.String())
	}

	for _, token := range tokens {
		eqIdx := strings.Index(token, "=")
		if eqIdx != -1 {
			k := strings.TrimSpace(token[:eqIdx])
			v := token[eqIdx+1:]
			result[k] = v
		}
	}
	return result
}

// parseTacviewTime parses common ISO and Tacview timestamp representations.
func parseTacviewTime(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	formats := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02T15:04:05Z",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
	}

	for _, layout := range formats {
		if t, err := time.Parse(layout, s); err == nil {
			return t.UTC(), nil
		}
	}
	return time.Time{}, fmt.Errorf("neznámý formát času: %s", s)
}
