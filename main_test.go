package main

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestCreateGeneratesUniqueIDs(t *testing.T) {
	store := &Store{path: filepath.Join(t.TempDir(), "records.json"), records: map[string]Record{}}
	first, err := store.create(Record{Kind: "action", Title: "Première action"})
	if err != nil {
		t.Fatal(err)
	}
	second, err := store.create(Record{Kind: "action", Title: "Deuxième action"})
	if err != nil {
		t.Fatal(err)
	}
	if first.ID == second.ID {
		t.Fatalf("generated duplicate ID %q", first.ID)
	}
	if !strings.HasPrefix(first.ID, "ACT-") || !idPattern.MatchString(first.ID) {
		t.Fatalf("invalid generated ID %q", first.ID)
	}
}

func TestCreateStillRejectsExplicitDuplicate(t *testing.T) {
	store := &Store{path: filepath.Join(t.TempDir(), "records.json"), records: map[string]Record{}}
	if _, err := store.create(Record{ID: "ACT-2026-001", Kind: "action", Title: "One"}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.create(Record{ID: "ACT-2026-001", Kind: "action", Title: "Two"}); err == nil {
		t.Fatal("expected duplicate error")
	}
}
