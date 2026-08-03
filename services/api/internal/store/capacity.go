package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// RoomAlone = one person takes one bedroom (single preferred).
// RoomShared = shares a double bed with the host or another guest (see ShareWith).
const (
	RoomAlone  = "alone"
	RoomShared = "shared"
	// Legacy value accepted on write; stored as shared + host.
	RoomDoubleWithHost = "double_with_host"

	ShareWithHost = "host"
)

type OccupationGuest struct {
	ID        string `json:"id"`
	FirstName string `json:"first_name"`
	Relation  string `json:"relation"`
	Room      string `json:"room"`       // alone | shared
	ShareWith string `json:"share_with"` // "" | host | pair:<id>
}

type CapacityWarning struct {
	MaxDay         string `json:"max_day"`
	People         int    `json:"people"`
	Places         int    `json:"places"`
	RoomsUsed      int    `json:"rooms_used"`
	RoomsAvailable int    `json:"rooms_available"`
	SingleBeds     int    `json:"single_beds"`
	DoubleBeds     int    `json:"double_beds"`
	Detail         string `json:"detail"`
	// Deprecated aliases for older clients.
	Capacity  int `json:"capacity"`
	Headcount int `json:"headcount"`
}

type DayLoad struct {
	Day       string `json:"day"`
	Headcount int    `json:"headcount"`
	Rooms     int    `json:"rooms"`
	OverCapacity bool `json:"over_capacity"`
}

var allowedGuestRelations = map[string]bool{
	"":         true,
	"ami":      true,
	"conjoint": true,
	"enfant":   true,
	"famille":  true,
	"autre":    true,
}

func (s *Store) migrateCapacity(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
ALTER TABLE houses
  ADD COLUMN IF NOT EXISTS bed_capacity INT NOT NULL DEFAULT 0;
ALTER TABLE houses
  ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
ALTER TABLE houses
  ADD COLUMN IF NOT EXISTS single_beds INT NOT NULL DEFAULT 0;
ALTER TABLE houses
  ADD COLUMN IF NOT EXISTS double_beds INT NOT NULL DEFAULT 0;

UPDATE houses
SET single_beds = bed_capacity
WHERE single_beds = 0 AND double_beds = 0 AND bed_capacity > 0;

CREATE TABLE IF NOT EXISTS occupation_guests (
  id UUID PRIMARY KEY,
  occupation_id UUID NOT NULL REFERENCES occupations (id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  relation TEXT NOT NULL DEFAULT '',
  room TEXT NOT NULL DEFAULT 'alone',
  share_with TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE occupation_guests
  ADD COLUMN IF NOT EXISTS room TEXT NOT NULL DEFAULT 'alone';
ALTER TABLE occupation_guests
  ADD COLUMN IF NOT EXISTS share_with TEXT NOT NULL DEFAULT '';
UPDATE occupation_guests
SET room = 'shared', share_with = 'host'
WHERE room = 'double_with_host';
CREATE INDEX IF NOT EXISTS occupation_guests_occ_idx ON occupation_guests (occupation_id);
`)
	return err
}

func NormalizeGuestRelation(raw string) (string, error) {
	r := raw
	if !allowedGuestRelations[r] {
		return "", fmt.Errorf("invalid_relation")
	}
	return r, nil
}

func NormalizeGuestRoom(raw string) (string, error) {
	r := strings.TrimSpace(raw)
	if r == "" {
		r = RoomAlone
	}
	switch r {
	case RoomAlone, RoomShared:
		return r, nil
	case RoomDoubleWithHost:
		return RoomShared, nil
	default:
		return "", fmt.Errorf("invalid_room")
	}
}

// NormalizeGuestShareWith accepts:
//   - "" (alone)
//   - "host"
//   - "guest:<index>" (0-based among guests in the same request; resolved to pair: before save)
//   - "pair:<id>" (already paired)
func NormalizeGuestShareWith(room, raw string) (string, error) {
	sw := strings.TrimSpace(raw)
	if room == RoomAlone {
		return "", nil
	}
	if room != RoomShared {
		return "", fmt.Errorf("invalid_share_with")
	}
	if sw == "" || sw == ShareWithHost {
		return ShareWithHost, nil
	}
	if strings.HasPrefix(sw, "guest:") || strings.HasPrefix(sw, "pair:") {
		return sw, nil
	}
	return "", fmt.Errorf("invalid_share_with")
}

// resolveGuestPairs validates sleeping arrangements and rewrites guest:N refs to pair:<uuid>.
func resolveGuestPairs(guests []OccupationGuest) error {
	hostShares := 0
	for i := range guests {
		if guests[i].Room != RoomShared {
			guests[i].ShareWith = ""
			continue
		}
		if guests[i].ShareWith == ShareWithHost {
			hostShares++
			continue
		}
	}
	if hostShares > 1 {
		return fmt.Errorf("too_many_host_shares")
	}

	type edge struct{ a, b int }
	seenPair := map[string]bool{}
	for i := range guests {
		sw := guests[i].ShareWith
		if !strings.HasPrefix(sw, "guest:") {
			continue
		}
		var j int
		if _, err := fmt.Sscanf(sw, "guest:%d", &j); err != nil {
			return fmt.Errorf("invalid_guest_pair")
		}
		if j < 0 || j >= len(guests) || j == i {
			return fmt.Errorf("invalid_guest_pair")
		}
		if guests[j].Room != RoomShared {
			return fmt.Errorf("invalid_guest_pair")
		}
		// Expect mutual guest:i ↔ guest:j (or already same pair key).
		other := guests[j].ShareWith
		mutual := other == fmt.Sprintf("guest:%d", i)
		samePair := strings.HasPrefix(other, "pair:") && other == sw
		if !mutual && !samePair {
			return fmt.Errorf("invalid_guest_pair")
		}
		a, b := i, j
		if a > b {
			a, b = b, a
		}
		key := fmt.Sprintf("%d:%d", a, b)
		if seenPair[key] {
			continue
		}
		seenPair[key] = true
		pairID := "pair:" + uuid.NewString()
		guests[i].ShareWith = pairID
		guests[j].ShareWith = pairID
	}

	// Validate pair: keys — exactly 2 guests per key.
	counts := map[string]int{}
	for _, g := range guests {
		if strings.HasPrefix(g.ShareWith, "pair:") {
			counts[g.ShareWith]++
		}
	}
	for _, n := range counts {
		if n != 2 {
			return fmt.Errorf("invalid_guest_pair")
		}
	}
	return nil
}

type HousePatch struct {
	BedCapacity *int // legacy: maps to single_beds when singles/doubles unset
	SingleBeds  *int
	DoubleBeds  *int
	Address     *string
}

func clampBeds(n int) (int, error) {
	if n < 0 {
		n = 0
	}
	if n > 50 {
		return 0, fmt.Errorf("capacity_too_high")
	}
	return n, nil
}

func (s *Store) UpdateHouse(ctx context.Context, houseID, userSub string, patch HousePatch) (House, error) {
	if patch.BedCapacity == nil && patch.Address == nil && patch.SingleBeds == nil && patch.DoubleBeds == nil {
		return House{}, fmt.Errorf("empty_patch")
	}
	if patch.SingleBeds != nil {
		n, err := clampBeds(*patch.SingleBeds)
		if err != nil {
			return House{}, err
		}
		*patch.SingleBeds = n
	}
	if patch.DoubleBeds != nil {
		n, err := clampBeds(*patch.DoubleBeds)
		if err != nil {
			return House{}, err
		}
		*patch.DoubleBeds = n
	}
	if patch.BedCapacity != nil && patch.SingleBeds == nil && patch.DoubleBeds == nil {
		n, err := clampBeds(*patch.BedCapacity)
		if err != nil {
			return House{}, err
		}
		patch.SingleBeds = &n
		zero := 0
		patch.DoubleBeds = &zero
	}
	if patch.Address != nil {
		addr := strings.TrimSpace(*patch.Address)
		if len([]rune(addr)) > 300 {
			return House{}, fmt.Errorf("address_too_long")
		}
		*patch.Address = addr
	}

	var role string
	err := s.pool.QueryRow(ctx, `
SELECT role FROM house_members WHERE house_id = $1 AND user_sub = $2`, houseID, userSub,
	).Scan(&role)
	if err != nil {
		return House{}, err
	}
	if role != "owner" {
		return House{}, fmt.Errorf("forbidden")
	}

	var h House
	err = s.pool.QueryRow(ctx, `
UPDATE houses SET
  single_beds = COALESCE($2, single_beds),
  double_beds = COALESCE($3, double_beds),
  address = COALESCE($4, address),
  bed_capacity = COALESCE($2, single_beds) + 2 * COALESCE($3, double_beds)
WHERE id = $1
RETURNING id::text, name, address, single_beds, double_beds, bed_capacity, created_at`,
		houseID, patch.SingleBeds, patch.DoubleBeds, patch.Address,
	).Scan(&h.ID, &h.Name, &h.Address, &h.SingleBeds, &h.DoubleBeds, &h.BedCapacity, &h.CreatedAt)
	if err != nil {
		return House{}, err
	}
	h.Role = role
	return h, nil
}

func (s *Store) UpdateHouseBedCapacity(ctx context.Context, houseID, userSub string, capacity int) (House, error) {
	return s.UpdateHouse(ctx, houseID, userSub, HousePatch{BedCapacity: &capacity})
}

func (s *Store) loadOccupationGuests(ctx context.Context, occIDs []string) (map[string][]OccupationGuest, error) {
	out := map[string][]OccupationGuest{}
	if len(occIDs) == 0 {
		return out, nil
	}
	rows, err := s.pool.Query(ctx, `
SELECT id::text, occupation_id::text, first_name, relation, room, share_with
FROM occupation_guests
WHERE occupation_id = ANY($1::uuid[])
ORDER BY created_at ASC`, occIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var occID string
		var g OccupationGuest
		if err := rows.Scan(&g.ID, &occID, &g.FirstName, &g.Relation, &g.Room, &g.ShareWith); err != nil {
			return nil, err
		}
		if g.Room == RoomDoubleWithHost {
			g.Room = RoomShared
			if g.ShareWith == "" {
				g.ShareWith = ShareWithHost
			}
		}
		if g.Room == "" {
			g.Room = RoomAlone
		}
		out[occID] = append(out[occID], g)
	}
	return out, rows.Err()
}

func occupationRoomNeeds(guests []OccupationGuest) (doubles, alones, people int) {
	people = 1 + len(guests)
	hostShared := false
	countedPair := map[string]bool{}
	aloneGuest := 0

	for _, g := range guests {
		room := g.Room
		sw := g.ShareWith
		if room == RoomDoubleWithHost {
			room = RoomShared
			if sw == "" {
				sw = ShareWithHost
			}
		}
		if room == RoomShared && sw == ShareWithHost {
			hostShared = true
			continue
		}
		if room == RoomShared && strings.HasPrefix(sw, "pair:") {
			if countedPair[sw] {
				continue
			}
			countedPair[sw] = true
			doubles++
			continue
		}
		aloneGuest++
	}
	if hostShared {
		doubles++
	} else {
		alones++ // host needs a bedroom
	}
	alones += aloneGuest
	return doubles, alones, people
}

func roomsFit(singleBeds, doubleBeds, needDouble, needAlone int) bool {
	if needDouble > doubleBeds {
		return false
	}
	doublesLeft := doubleBeds - needDouble
	if needAlone <= singleBeds {
		return true
	}
	return needAlone-singleBeds <= doublesLeft
}

func placesTotal(singleBeds, doubleBeds int) int {
	return singleBeds + 2*doubleBeds
}

func (s *Store) houseBeds(ctx context.Context, houseID string) (singles, doubles int, err error) {
	err = s.pool.QueryRow(ctx, `
SELECT single_beds, double_beds FROM houses WHERE id = $1`, houseID).Scan(&singles, &doubles)
	return
}

func (s *Store) PeakCapacity(ctx context.Context, houseID string, from, to time.Time) (CapacityWarning, error) {
	singles, doubles, err := s.houseBeds(ctx, houseID)
	if err != nil {
		return CapacityWarning{}, err
	}
	places := placesTotal(singles, doubles)
	roomsAvail := singles + doubles
	w := CapacityWarning{
		SingleBeds:     singles,
		DoubleBeds:     doubles,
		Places:         places,
		RoomsAvailable: roomsAvail,
		Capacity:       places,
	}
	if places <= 0 && roomsAvail <= 0 {
		return w, nil
	}

	list, err := s.ListOccupations(ctx, houseID, from, to)
	if err != nil {
		return CapacityWarning{}, err
	}

	type dayAgg struct {
		people, doubles, alones int
	}
	byDay := map[string]*dayAgg{}
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		key := d.Format("2006-01-02")
		byDay[key] = &dayAgg{}
	}
	for _, o := range list {
		start, _ := time.Parse("2006-01-02", o.StartDate)
		end, _ := time.Parse("2006-01-02", o.EndDate)
		needD, needA, people := occupationRoomNeeds(o.Guests)
		for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
			key := d.Format("2006-01-02")
			agg, ok := byDay[key]
			if !ok {
				continue
			}
			agg.people += people
			agg.doubles += needD
			agg.alones += needA
		}
	}

	var worst *dayAgg
	var worstDay string
	over := false
	for day, agg := range byDay {
		bad := !roomsFit(singles, doubles, agg.doubles, agg.alones) || (places > 0 && agg.people > places)
		rooms := agg.doubles + agg.alones
		pick := worst == nil
		if !pick && bad && !over {
			pick = true
		}
		if !pick && bad == over && rooms > worst.doubles+worst.alones {
			pick = true
		}
		if pick {
			cp := *agg
			worst = &cp
			worstDay = day
		}
		if bad {
			over = true
		}
	}
	if worst == nil {
		return w, nil
	}
	w.MaxDay = worstDay
	w.People = worst.people
	w.Headcount = worst.people
	w.RoomsUsed = worst.doubles + worst.alones
	if over {
		w.Detail = fmt.Sprintf(
			"%d pers. / %d places · %d chambres utilisées pour %d dispo (%d simples, %d doubles)",
			w.People, places, w.RoomsUsed, roomsAvail, singles, doubles,
		)
	}
	return w, nil
}

func (s *Store) PeakHeadcount(ctx context.Context, houseID string, from, to time.Time) (CapacityWarning, error) {
	return s.PeakCapacity(ctx, houseID, from, to)
}

func (s *Store) DayLoads(ctx context.Context, houseID string, from, to time.Time) ([]DayLoad, error) {
	singles, doubles, err := s.houseBeds(ctx, houseID)
	if err != nil {
		return nil, err
	}
	places := placesTotal(singles, doubles)
	list, err := s.ListOccupations(ctx, houseID, from, to)
	if err != nil {
		return nil, err
	}

	type dayAgg struct{ people, doubles, alones int }
	byDay := map[string]*dayAgg{}
	var order []string
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		key := d.Format("2006-01-02")
		byDay[key] = &dayAgg{}
		order = append(order, key)
	}
	for _, o := range list {
		start, _ := time.Parse("2006-01-02", o.StartDate)
		end, _ := time.Parse("2006-01-02", o.EndDate)
		needD, needA, people := occupationRoomNeeds(o.Guests)
		for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
			key := d.Format("2006-01-02")
			agg, ok := byDay[key]
			if !ok {
				continue
			}
			agg.people += people
			agg.doubles += needD
			agg.alones += needA
		}
	}

	out := make([]DayLoad, 0, len(order))
	for _, day := range order {
		agg := byDay[day]
		rooms := agg.doubles + agg.alones
		over := false
		if places > 0 || singles+doubles > 0 {
			over = !roomsFit(singles, doubles, agg.doubles, agg.alones) || (places > 0 && agg.people > places)
		}
		out = append(out, DayLoad{
			Day:          day,
			Headcount:    agg.people,
			Rooms:        rooms,
			OverCapacity: over,
		})
	}
	return out, nil
}

func (s *Store) CreateOccupationWithGuests(
	ctx context.Context,
	houseID, userSub string,
	start, end time.Time,
	note string,
	guests []OccupationGuest,
) (Occupation, *CapacityWarning, error) {
	if err := normalizeGuestsForSave(guests); err != nil {
		return Occupation{}, nil, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Occupation{}, nil, err
	}
	defer tx.Rollback(ctx)

	id := uuid.NewString()
	var o Occupation
	var startOut, endOut time.Time
	err = tx.QueryRow(ctx, `
INSERT INTO occupations (id, house_id, user_sub, start_date, end_date, note)
VALUES ($1, $2, $3, $4::date, $5::date, $6)
RETURNING id::text, house_id::text, user_sub, start_date, end_date, note, created_at`,
		id, houseID, userSub, start, end, note,
	).Scan(&o.ID, &o.HouseID, &o.UserSub, &startOut, &endOut, &o.Note, &o.CreatedAt)
	if err != nil {
		return Occupation{}, nil, err
	}
	o.StartDate = formatDate(startOut)
	o.EndDate = formatDate(endOut)
	o.Guests = []OccupationGuest{}

	for _, g := range guests {
		gid := uuid.NewString()
		var saved OccupationGuest
		err = tx.QueryRow(ctx, `
INSERT INTO occupation_guests (id, occupation_id, first_name, relation, room, share_with)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id::text, first_name, relation, room, share_with`,
			gid, id, g.FirstName, g.Relation, g.Room, g.ShareWith,
		).Scan(&saved.ID, &saved.FirstName, &saved.Relation, &saved.Room, &saved.ShareWith)
		if err != nil {
			return Occupation{}, nil, err
		}
		o.Guests = append(o.Guests, saved)
	}
	o.Headcount = 1 + len(o.Guests)

	if err := tx.Commit(ctx); err != nil {
		return Occupation{}, nil, err
	}

	peak, err := s.PeakCapacity(ctx, houseID, start, end)
	if err != nil {
		return o, nil, nil
	}
	if peak.Detail != "" {
		return o, &peak, nil
	}
	return o, nil, nil
}

func normalizeGuestsForSave(guests []OccupationGuest) error {
	for i := range guests {
		room, err := NormalizeGuestRoom(guests[i].Room)
		if err != nil {
			return err
		}
		sw, err := NormalizeGuestShareWith(room, guests[i].ShareWith)
		if err != nil {
			return err
		}
		if guests[i].Room == RoomDoubleWithHost && strings.TrimSpace(guests[i].ShareWith) == "" {
			sw = ShareWithHost
		}
		guests[i].Room = room
		guests[i].ShareWith = sw
	}
	return resolveGuestPairs(guests)
}

func (s *Store) UpdateOccupationWithGuests(
	ctx context.Context,
	occupationID, userSub string,
	start, end time.Time,
	note string,
	guests []OccupationGuest,
	replaceGuests bool,
) (Occupation, *CapacityWarning, error) {
	if replaceGuests {
		if err := normalizeGuestsForSave(guests); err != nil {
			return Occupation{}, nil, err
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Occupation{}, nil, err
	}
	defer tx.Rollback(ctx)

	var o Occupation
	var startOut, endOut time.Time
	var houseID string
	err = tx.QueryRow(ctx, `
UPDATE occupations
SET start_date = $3::date, end_date = $4::date, note = $5
WHERE id = $1 AND user_sub = $2
RETURNING id::text, house_id::text, user_sub, start_date, end_date, note, created_at`,
		occupationID, userSub, start, end, note,
	).Scan(&o.ID, &houseID, &o.UserSub, &startOut, &endOut, &o.Note, &o.CreatedAt)
	if err != nil {
		return Occupation{}, nil, err
	}
	o.HouseID = houseID
	o.StartDate = formatDate(startOut)
	o.EndDate = formatDate(endOut)

	if replaceGuests {
		if _, err := tx.Exec(ctx, `DELETE FROM occupation_guests WHERE occupation_id = $1`, occupationID); err != nil {
			return Occupation{}, nil, err
		}
		o.Guests = []OccupationGuest{}
		for _, g := range guests {
			gid := uuid.NewString()
			var saved OccupationGuest
			err = tx.QueryRow(ctx, `
INSERT INTO occupation_guests (id, occupation_id, first_name, relation, room, share_with)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id::text, first_name, relation, room, share_with`,
				gid, occupationID, g.FirstName, g.Relation, g.Room, g.ShareWith,
			).Scan(&saved.ID, &saved.FirstName, &saved.Relation, &saved.Room, &saved.ShareWith)
			if err != nil {
				return Occupation{}, nil, err
			}
			o.Guests = append(o.Guests, saved)
		}
	} else {
		loaded, err := s.loadOccupationGuests(ctx, []string{occupationID})
		if err != nil {
			return Occupation{}, nil, err
		}
		o.Guests = loaded[occupationID]
		if o.Guests == nil {
			o.Guests = []OccupationGuest{}
		}
	}
	o.Headcount = 1 + len(o.Guests)

	if err := tx.Commit(ctx); err != nil {
		return Occupation{}, nil, err
	}

	peak, err := s.PeakCapacity(ctx, houseID, start, end)
	if err != nil {
		return o, nil, nil
	}
	if peak.Detail != "" {
		return o, &peak, nil
	}
	return o, nil, nil
}

func (s *Store) CreateOccupation(ctx context.Context, houseID, userSub string, start, end time.Time, note string) (Occupation, error) {
	o, _, err := s.CreateOccupationWithGuests(ctx, houseID, userSub, start, end, note, nil)
	return o, err
}
