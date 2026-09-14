package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

type Record struct {
	ID          string   `json:"id"`
	Kind        string   `json:"kind"`
	Title       string   `json:"title"`
	Description string   `json:"description,omitempty"`
	Status      string   `json:"status"`
	Date        string   `json:"date,omitempty"`
	EndDate     string   `json:"endDate,omitempty"`
	Subject     string   `json:"subject,omitempty"`
	Predicate   string   `json:"predicate,omitempty"`
	Value       string   `json:"value,omitempty"`
	Tags        []string `json:"tags,omitempty"`
	RelatedIDs  []string `json:"relatedIds,omitempty"`
	CreatedAt   string   `json:"createdAt"`
	UpdatedAt   string   `json:"updatedAt"`
}

type Store struct {
	mu      sync.RWMutex
	path    string
	records map[string]Record
}

var idPattern = regexp.MustCompile(`^[A-Z][A-Z0-9]{1,7}(?:-[A-Z0-9]{2,12}){1,3}$`)
var validKinds = map[string]bool{"action": true, "event": true, "journal": true, "fact": true}

func newStore(path string) (*Store, error) {
	s := &Store{path: path, records: map[string]Record{}}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		for _, r := range seedRecords() {
			s.records[r.ID] = r
		}
		return s, s.saveLocked()
	}
	if err != nil {
		return nil, err
	}
	var records []Record
	if err := json.Unmarshal(data, &records); err != nil {
		return nil, err
	}
	for _, r := range records {
		s.records[r.ID] = r
	}
	return s, nil
}

func (s *Store) saveLocked() error {
	records := make([]Record, 0, len(s.records))
	for _, r := range s.records {
		records = append(records, r)
	}
	sort.Slice(records, func(i, j int) bool { return records[i].CreatedAt < records[j].CreatedAt })
	data, err := json.MarshalIndent(records, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0755); err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0644); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func (s *Store) list() []Record {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]Record, 0, len(s.records))
	for _, r := range s.records {
		result = append(result, r)
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Date == result[j].Date {
			return result[i].UpdatedAt > result[j].UpdatedAt
		}
		if result[i].Date == "" {
			return false
		}
		if result[j].Date == "" {
			return true
		}
		return result[i].Date < result[j].Date
	})
	return result
}

func (s *Store) create(r Record) (Record, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r.ID = strings.ToUpper(strings.TrimSpace(r.ID))
	r.Title = strings.TrimSpace(r.Title)
	if !idPattern.MatchString(r.ID) {
		return r, fmt.Errorf("l’identifiant doit suivre le format TYPE-IDENTIFIANT (ex. ACT-2026-001)")
	}
	if _, exists := s.records[r.ID]; exists {
		return r, fmt.Errorf("l’identifiant %s existe déjà", r.ID)
	}
	if !validKinds[r.Kind] {
		return r, fmt.Errorf("type d’objet invalide")
	}
	if r.Title == "" {
		return r, fmt.Errorf("le titre est obligatoire")
	}
	for _, relatedID := range r.RelatedIDs {
		if _, exists := s.records[relatedID]; !exists {
			return r, fmt.Errorf("l’objet lié %s n’existe pas", relatedID)
		}
	}
	if r.Status == "" {
		r.Status = "active"
	}
	now := time.Now().UTC().Format(time.RFC3339)
	r.CreatedAt = now
	r.UpdatedAt = now
	s.records[r.ID] = r
	if err := s.saveLocked(); err != nil {
		delete(s.records, r.ID)
		return r, err
	}
	return r, nil
}

func (s *Store) update(id string, patch Record) (Record, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.records[id]
	if !ok {
		return r, os.ErrNotExist
	}
	if patch.Title != "" {
		r.Title = strings.TrimSpace(patch.Title)
	}
	if patch.Description != "" {
		r.Description = patch.Description
	}
	if patch.Status != "" {
		r.Status = patch.Status
	}
	if patch.Date != "" {
		r.Date = patch.Date
	}
	if patch.EndDate != "" {
		r.EndDate = patch.EndDate
	}
	if patch.Tags != nil {
		r.Tags = patch.Tags
	}
	if patch.RelatedIDs != nil {
		r.RelatedIDs = patch.RelatedIDs
	}
	r.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	s.records[id] = r
	if err := s.saveLocked(); err != nil {
		return r, err
	}
	return r, nil
}

func seedRecords() []Record {
	now := time.Now()
	stamp := now.UTC().Format(time.RFC3339)
	date := func(offset int, hour string) string {
		return now.AddDate(0, 0, offset).Format("2006-01-02") + "T" + hour
	}
	return []Record{
		{ID: "ACT-2026-001", Kind: "action", Title: "Préparer le dossier fiscal", Description: "Rassembler les justificatifs et vérifier les montants.", Status: "active", Date: date(1, "09:30"), Tags: []string{"administratif"}, RelatedIDs: []string{"PER-MARIE"}, CreatedAt: stamp, UpdatedAt: stamp},
		{ID: "RDV-DENTISTE", Kind: "event", Title: "Rendez-vous dentiste", Description: "Contrôle annuel.", Status: "scheduled", Date: date(3, "14:00"), EndDate: date(3, "15:00"), Tags: []string{"santé"}, RelatedIDs: []string{"LIE-CABINET"}, CreatedAt: stamp, UpdatedAt: stamp},
		{ID: "JRN-2026-042", Kind: "journal", Title: "Appel avec Marie", Description: "Décision prise : finaliser le dossier avant vendredi.", Status: "done", Date: date(-1, "17:15"), Tags: []string{"famille"}, RelatedIDs: []string{"PER-MARIE", "ACT-2026-001"}, CreatedAt: stamp, UpdatedAt: stamp},
		{ID: "PER-MARIE", Kind: "fact", Title: "Marie Dupont", Subject: "Marie Dupont", Predicate: "relation", Value: "Sœur — préfère être appelée le soir", Status: "known", Tags: []string{"personne", "famille"}, CreatedAt: stamp, UpdatedAt: stamp},
		{ID: "LIE-CABINET", Kind: "fact", Title: "Cabinet dentaire", Subject: "Cabinet dentaire", Predicate: "adresse", Value: "18 rue des Lilas, Paris", Status: "known", Tags: []string{"lieu", "santé"}, CreatedAt: stamp, UpdatedAt: stamp},
	}
}

func jsonResponse(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func main() {
	store, err := newStore(filepath.Join("data", "records.json"))
	if err != nil {
		log.Fatal(err)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/records", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			jsonResponse(w, 200, store.list())
		case http.MethodPost:
			var record Record
			if err := json.NewDecoder(r.Body).Decode(&record); err != nil {
				jsonResponse(w, 400, map[string]string{"error": "requête invalide"})
				return
			}
			created, err := store.create(record)
			if err != nil {
				jsonResponse(w, 409, map[string]string{"error": err.Error()})
				return
			}
			jsonResponse(w, 201, created)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/records/", func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimPrefix(r.URL.Path, "/api/records/")
		if id == "" {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodPatch {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var patch Record
		if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
			jsonResponse(w, 400, map[string]string{"error": "requête invalide"})
			return
		}
		updated, err := store.update(id, patch)
		if errors.Is(err, os.ErrNotExist) {
			http.NotFound(w, r)
			return
		}
		if err != nil {
			jsonResponse(w, 500, map[string]string{"error": err.Error()})
			return
		}
		jsonResponse(w, 200, updated)
	})
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) { jsonResponse(w, 200, map[string]string{"status": "ok"}) })
	dist := http.Dir("frontend/dist")
	mux.Handle("/assets/", http.FileServer(dist))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, "frontend/dist/index.html")
	})
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Personal Manager disponible sur http://localhost:%s", port)
	log.Fatal(http.ListenAndServe(":"+port, logging(mux)))
}

func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		log.Printf("%s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}
