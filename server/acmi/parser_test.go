package acmi

import (
	"testing"
	"time"

	"dcs-radar/models"
)

func TestParserLifecycle(t *testing.T) {
	p := NewParser()

	// 1. Header
	rec, err := p.ParseLine("FileType=text/acmi/tacview")
	if err != nil || rec.Type != RecordTypeHeader {
		t.Fatalf("expected header record, got %v, err=%v", rec, err)
	}

	rec, err = p.ParseLine("FileVersion=2.2")
	if err != nil || p.FileVersion != "2.2" {
		t.Fatalf("expected version 2.2, got %s", p.FileVersion)
	}

	// 2. Global reference time & coordinates
	rec, err = p.ParseLine("0,ReferenceTime=2026-10-22T12:00:00Z,ReferenceLongitude=36,ReferenceLatitude=38,Title=DCS Server Caucasus")
	if err != nil || rec.Type != RecordTypeGlobal {
		t.Fatalf("expected global record, got %v, err=%v", rec, err)
	}
	expectedRef := time.Date(2026, 10, 22, 12, 0, 0, 0, time.UTC)
	if !p.ReferenceTime.Equal(expectedRef) {
		t.Errorf("expected reference time %v, got %v", expectedRef, p.ReferenceTime)
	}
	if p.ReferenceLongitude != 36.0 {
		t.Errorf("expected ReferenceLongitude 36.0, got %f", p.ReferenceLongitude)
	}
	if p.ReferenceLatitude != 38.0 {
		t.Errorf("expected ReferenceLatitude 38.0, got %f", p.ReferenceLatitude)
	}

	// 3. Multi-line comment (ending with \)
	rec, err = p.ParseLine("0,Comments=First line of comments\\\r\n")
	if err != nil || rec.Type != RecordTypeEmpty {
		t.Fatalf("expected empty record for continuation line, got %v", rec)
	}
	rec, err = p.ParseLine("Second line of comments\\\r\n")
	if err != nil || rec.Type != RecordTypeEmpty {
		t.Fatalf("expected empty record for continuation line, got %v", rec)
	}
	rec, err = p.ParseLine("Third and final line\r\n")
	if err != nil || rec.Type != RecordTypeGlobal {
		t.Fatalf("expected completed global record, got %v", rec)
	}

	// 4. Timestamp frame
	rec, err = p.ParseLine("#10.50")
	if err != nil || rec.Type != RecordTypeTimestamp || rec.TimeOffset != 10.50 {
		t.Fatalf("expected timestamp 10.50, got %v", rec)
	}

	// 5. Object creation (relative coords: lon=5.5 -> 36+5.5=41.5, lat=4.0 -> 38+4.0=42.0)
	rec, err = p.ParseLine("1001,T=5.5|4.0|5000|0|0|90,Name=F-16C_50,Type=Air+FixedWing,Coalition=Allies,Color=Blue,Pilot=ViperOne")
	if err != nil || rec.Type != RecordTypeUpdate {
		t.Fatalf("expected update record, got %v, err=%v", rec, err)
	}
	obj := rec.Object
	if obj.ID != "1001" || obj.Name != "F-16C_50" || obj.Pilot != "ViperOne" {
		t.Errorf("unexpected object fields: %+v", obj)
	}
	if obj.Coalition != models.CoalitionBlue {
		t.Errorf("expected CoalitionBlue, got %s", obj.Coalition)
	}
	if obj.Category != models.CategoryAirFixedWing {
		t.Errorf("expected CategoryAirFixedWing, got %s", obj.Category)
	}
	if obj.CurrentTransform.Longitude != 41.5 {
		t.Errorf("expected calculated lon 41.5, got %f", obj.CurrentTransform.Longitude)
	}
	if obj.CurrentTransform.Latitude != 42.0 {
		t.Errorf("expected calculated lat 42.0, got %f", obj.CurrentTransform.Latitude)
	}

	// 6. Sparse update at next timestamp
	rec, _ = p.ParseLine("#12.00")
	rec, err = p.ParseLine("1001,T=5.55|4.01|5020|||92")
	if err != nil || rec.Type != RecordTypeUpdate {
		t.Fatalf("expected sparse update, got %v", rec)
	}
	if rec.Object.CurrentTransform.Longitude != 41.55 {
		t.Errorf("expected updated lon 41.55, got %f", rec.Object.CurrentTransform.Longitude)
	}
}
