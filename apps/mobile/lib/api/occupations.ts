import { apiBaseUrl, authHeaders, getJSON } from '@/lib/api/http';

export type GuestRelation = 'ami' | 'conjoint' | 'enfant' | 'famille' | 'autre' | '';

/** alone = own bedroom; shared = double bed with host or another guest */
export type GuestRoom = 'alone' | 'shared';

/** host | guest:<index> on write; host | pair:<id> when stored */
export type GuestShareWith = 'host' | string;

export type OccupationGuest = {
  id?: string;
  first_name: string;
  relation: GuestRelation | string;
  room: GuestRoom | string;
  share_with?: GuestShareWith;
};

export type Occupation = {
  id: string;
  house_id: string;
  user_sub: string;
  start_date: string;
  end_date: string;
  note: string;
  created_at: string;
  guests: OccupationGuest[];
  headcount: number;
};

export type DayLoad = {
  day: string;
  headcount: number;
  rooms: number;
  over_capacity: boolean;
};

export type CapacityWarning = {
  max_day: string;
  people: number;
  places: number;
  rooms_used: number;
  rooms_available: number;
  single_beds: number;
  double_beds: number;
  detail: string;
  capacity?: number;
  headcount?: number;
};

export type OccupationsMonth = {
  occupations: Occupation[];
  bed_capacity: number;
  single_beds: number;
  double_beds: number;
  day_loads: DayLoad[];
};

export type CreateOccupationResult = {
  occupation: Occupation;
  capacity_warning: CapacityWarning | null;
};

export const GUEST_RELATION_LABELS: Record<string, string> = {
  ami: 'Ami',
  conjoint: 'Conjoint',
  enfant: 'Enfant',
  famille: 'Famille',
  autre: 'Autre',
  '': '—',
};

export function guestSleepLabel(g: OccupationGuest, all: OccupationGuest[]): string {
  const room = g.room === 'double_with_host' ? 'shared' : g.room;
  const sw = g.share_with || (g.room === 'double_with_host' ? 'host' : '');
  if (room !== 'shared') return '';
  if (sw === 'host') return ' · lit double avec toi';
  if (sw.startsWith('pair:')) {
    const other = all.find((x) => x !== g && x.share_with === sw);
    return other?.first_name ? ` · lit double avec ${other.first_name}` : ' · lit double';
  }
  if (sw.startsWith('guest:')) {
    const idx = Number(sw.slice(6));
    const other = all[idx];
    return other?.first_name ? ` · lit double avec ${other.first_name}` : ' · lit double';
  }
  return ' · lit double';
}

export async function fetchOccupations(
  accessToken: string,
  houseId: string,
  from: string,
  to: string,
): Promise<OccupationsMonth> {
  const q = new URLSearchParams({ from, to });
  return getJSON(`/houses/${houseId}/occupations?${q}`, {
    headers: authHeaders(accessToken),
  });
}

export async function createOccupation(
  accessToken: string,
  houseId: string,
  input: {
    start_date: string;
    end_date: string;
    note?: string;
    guests?: OccupationGuest[];
  },
): Promise<CreateOccupationResult> {
  return getJSON(`/houses/${houseId}/occupations`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function updateOccupation(
  accessToken: string,
  occupationId: string,
  input: {
    start_date: string;
    end_date: string;
    note?: string;
    guests?: OccupationGuest[];
  },
): Promise<CreateOccupationResult> {
  return getJSON(`/occupations/${occupationId}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function deleteOccupation(accessToken: string, occupationId: string): Promise<void> {
  const res = await fetch(`${apiBaseUrl()}/occupations/${occupationId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}

/** Convert stored guests (pair:/host) into editable guest:N share refs. */
export function guestsForEditForm(guests: OccupationGuest[]): OccupationGuest[] {
  const pairToIndices = new Map<string, number[]>();
  guests.forEach((g, i) => {
    const sw = g.share_with || '';
    if (sw.startsWith('pair:')) {
      const arr = pairToIndices.get(sw) ?? [];
      arr.push(i);
      pairToIndices.set(sw, arr);
    }
  });
  return guests.map((g, i) => {
    const room = g.room === 'double_with_host' || g.room === 'shared' ? 'shared' : 'alone';
    const sw = g.share_with || (g.room === 'double_with_host' ? 'host' : '');
    if (room === 'shared' && sw === 'host') {
      return {
        first_name: g.first_name,
        relation: (g.relation || 'ami') as GuestRelation,
        room: 'shared',
        share_with: 'host',
      };
    }
    if (room === 'shared' && sw.startsWith('pair:')) {
      const idxs = pairToIndices.get(sw) ?? [];
      const other = idxs.find((j) => j !== i);
      if (other !== undefined) {
        return {
          first_name: g.first_name,
          relation: (g.relation || 'ami') as GuestRelation,
          room: 'shared',
          share_with: `guest:${other}`,
        };
      }
    }
    return {
      first_name: g.first_name,
      relation: (g.relation || 'ami') as GuestRelation,
      room: 'alone',
      share_with: '',
    };
  });
}
