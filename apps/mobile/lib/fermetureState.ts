import type { Closing, Occupation } from '@/lib/api';

export type FermetureKind = 'en_cours' | 'ouverte' | 'fermee';

export type FermetureState = {
  kind: FermetureKind;
  label: string;
  openClosingId?: string;
  canStart: boolean;
  /** Why start is blocked when canStart is false and not en_cours. */
  startBlockedReason?: 'not_present' | 'fermee';
};

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** True if occupation date range covers today (inclusive). */
export function occupationCoversToday(o: Pick<Occupation, 'start_date' | 'end_date'>, today = todayKey()): boolean {
  return o.start_date <= today && o.end_date >= today;
}

export function isUserPresentToday(
  occupations: Occupation[] | undefined,
  userSub: string | undefined,
): boolean {
  if (!userSub || !occupations?.length) return false;
  return occupations.some((o) => o.user_sub === userSub && occupationCoversToday(o));
}

export function fermetureState(input: {
  closings: Closing[] | undefined;
  todayHeadcount: number;
  iAmPresent: boolean;
}): FermetureState {
  const open = (input.closings ?? []).find((c) => c.status === 'open');
  if (open) {
    return {
      kind: 'en_cours',
      label: 'En cours',
      openClosingId: open.id,
      canStart: false,
    };
  }

  if (input.todayHeadcount > 0) {
    return {
      kind: 'ouverte',
      label: 'Maison ouverte',
      canStart: input.iAmPresent,
      startBlockedReason: input.iAmPresent ? undefined : 'not_present',
    };
  }

  return {
    kind: 'fermee',
    label: 'Maison fermée',
    canStart: false,
    startBlockedReason: 'fermee',
  };
}
