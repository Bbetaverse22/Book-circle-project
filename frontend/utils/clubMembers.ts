import { AGENTS } from '../constants/agents';
import { kvGet, kvSet } from './kvStore';

// How many members the reader brings into one club session.
export const CLUB_SIZE = 3;

const CLUB_MEMBERS_KEY = 'bookcircle_club_members';

// The reader's last club, so the picker starts where they left off.
export async function loadClubMembers(): Promise<string[]> {
  const saved = await kvGet(CLUB_MEMBERS_KEY);
  const ids = (saved ?? '').split(',').filter((id) => AGENTS[id]);
  return ids.length === CLUB_SIZE ? ids : [];
}

export async function saveClubMembers(ids: string[]): Promise<void> {
  await kvSet(CLUB_MEMBERS_KEY, ids.join(','));
}
