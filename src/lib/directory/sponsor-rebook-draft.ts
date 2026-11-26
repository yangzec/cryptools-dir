/** sessionStorage draft for TTL-expired rebook → /advertise prefill. */

export const SPONSOR_REBOOK_DRAFT_KEY = 'directory:sponsor-rebook-draft';

/** Drop stale drafts so a later normal /advertise visit stays empty. */
const DRAFT_TTL_MS = 30 * 60 * 1000;

export type SponsorRebookDraft = {
  name: string;
  tagline: string;
  url: string;
  iconUrl?: string;
  tier: 'silver' | 'gold' | 'platinum';
  savedAt: number;
};

type DraftFields = Omit<SponsorRebookDraft, 'savedAt'>;

/** Survives React Strict Mode remount after sessionStorage was taken. */
let memoryDraft: DraftFields | null = null;

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
}

function parseDraft(raw: string): DraftFields | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SponsorRebookDraft>;
    if (
      typeof parsed.savedAt !== 'number' ||
      Date.now() - parsed.savedAt > DRAFT_TTL_MS
    ) {
      return null;
    }
    const tier = parsed.tier;
    if (tier !== 'silver' && tier !== 'gold' && tier !== 'platinum') {
      return null;
    }
    const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
    const tagline =
      typeof parsed.tagline === 'string' ? parsed.tagline.trim() : '';
    const url = typeof parsed.url === 'string' ? parsed.url.trim() : '';
    if (!name || !tagline || !url) return null;
    const iconUrl =
      typeof parsed.iconUrl === 'string' ? parsed.iconUrl.trim() : '';
    return {
      name,
      tagline,
      url,
      tier,
      ...(iconUrl ? { iconUrl } : {}),
    };
  } catch {
    return null;
  }
}

export function saveSponsorRebookDraft(draft: DraftFields) {
  memoryDraft = null;
  if (!canUseSessionStorage()) return;
  const payload: SponsorRebookDraft = { ...draft, savedAt: Date.now() };
  try {
    sessionStorage.setItem(SPONSOR_REBOOK_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode — rebook still works with an empty form.
  }
}

export function clearSponsorRebookDraft() {
  memoryDraft = null;
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.removeItem(SPONSOR_REBOOK_DRAFT_KEY);
  } catch {
    // ignore
  }
}

/**
 * Read draft once into memory (and clear sessionStorage).
 * Normal /advertise without a prior save gets null.
 */
export function takeSponsorRebookDraft(): DraftFields | null {
  if (memoryDraft) return memoryDraft;
  if (!canUseSessionStorage()) return null;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(SPONSOR_REBOOK_DRAFT_KEY);
    sessionStorage.removeItem(SPONSOR_REBOOK_DRAFT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  const draft = parseDraft(raw);
  if (draft) memoryDraft = draft;
  return draft;
}
