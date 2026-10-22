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

	// 2. Global reference time
	rec, err = p.ParseLine("0,ReferenceTime=2026-10-22T12:00:00Z,Title=DCS Server Caucasus")
	if err != nil || rec.Type != RecordTypeGlobal {
		t.Fatalf("expected global record, got %v, err=%v", rec, err)
	}
	expectedRef := time.Date(2026, 10, 22, 12, 0, 0, 0, time.UTC)
	if !p.ReferenceTime.Equal(expectedRef) {
		t.Errorf("expected reference time %v, got %v", expectedRef, p.ReferenceTime)
	}

	// 3. Timestamp frame
	rec, err = p.ParseLine("#10.50")
	if err != nil || rec.Type != RecordTypeTimestamp || rec.TimeOffset != 10.50 {
		t.Fatalf("expected timestamp 10.50, got %v", rec)
	}

	// 4. Object creation
	rec, err = p.ParseLine("1001,T=41.5|42.0|5000|0|0|90,Name=F-16C_50,Type=Air+FixedWing,Coalition=Allies,Color=Blue,Pilot=ViperOne")
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

	// 5. Sparse update at next timestamp
	rec, _ = p.ParseLine("#12.00")
	rec, err = p.ParseLine("1001,T=41.55|42.01|5020|||92")
	if err != nil || rec.Type != RecordTypeUpdate {
		t.Fatalf("expected sparse update, got %v", rec)
	}
	if rec.Object.CurrentTransform.Latitude != 42.01 {
		t.Errorf("expected lat 42.01, got %f", rec.Object.CurrentTransform.Latitude)
	}
	if rec.Object.CurrentTransform.Roll != 0 {
		t.Errorf("expected preserved roll 0, got %f", rec.Object.CurrentTransform.Roll)
	}

	// 6. Object deletion
	rec, err = p.ParseLine("-1001")
	if err != nil || rec.Type != RecordTypeDelete || rec.ObjectID != "1001" {
		t.Fatalf("expected delete record for 1001, got %v", rec)
	}
}

func TestParserEscapedCommas(t *testing.T) {
	props := splitProperties(`Title=Mission\, Operation Falcon,Author=Eagle\, Team,Type=Air+FixedWing`)
	if props["Title"] != "Mission, Operation Falcon" {
		t.Errorf("failed to unescape comma in Title: got '%s'", props["Title"])
	}
	if props["Author"] != "Eagle, Team" {
		t.Errorf("failed to unescape comma in Author: got '%s'", props["Author"])
	}
}
