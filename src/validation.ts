import type { Person, PartialDate } from './types';

/**
 * Get all descendant IDs of a person (recursive).
 */
export function getDescendantIds(personId: string, people: Person[]): Set<string> {
  const descendants = new Set<string>();
  const queue = [personId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const p of people) {
      if (p.parentIds.includes(current) && !descendants.has(p.id)) {
        descendants.add(p.id);
        queue.push(p.id);
      }
    }
  }
  return descendants;
}

/**
 * Get all ancestor IDs of a person (recursive).
 */
export function getAncestorIds(personId: string, people: Person[]): Set<string> {
  const ancestors = new Set<string>();
  const queue = [personId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    const person = people.find(p => p.id === current);
    if (person) {
      for (const pid of person.parentIds) {
        if (!ancestors.has(pid)) {
          ancestors.add(pid);
          queue.push(pid);
        }
      }
    }
  }
  return ancestors;
}

/**
 * Check if adding `candidateParentId` as a parent of `personId` would create a cycle.
 */
export function wouldCreateCycle(personId: string, candidateParentId: string, people: Person[]): boolean {
  if (personId === candidateParentId) return true;
  const descendants = getDescendantIds(personId, people);
  return descendants.has(candidateParentId);
}

/**
 * Parse a user-entered date string into a PartialDate.
 * Accepts "YYYY" (year only) or "YYYY-MM-DD" (full date).
 * Returns undefined for empty/blank input.
 * Returns { error } for invalid input.
 */
export function parseDateInput(input: string): { value?: PartialDate; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) return {}; // empty => no date

  // Year only: 1-4+ digit number
  if (/^\d+$/.test(trimmed)) {
    const year = parseInt(trimmed, 10);
    return { value: { year } };
  }

  // Full date: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const year = parseInt(trimmed.split('-')[0], 10);
    // Basic sanity: try parsing
    const parsed = new Date(trimmed + 'T00:00:00');
    if (isNaN(parsed.getTime())) {
      return { error: `"${trimmed}" is not a valid date` };
    }
    return { value: { year, date: trimmed } };
  }

  return { error: `Enter a year (e.g. 1950) or full date (e.g. 1950-03-15)` };
}

/**
 * Format a PartialDate back into the single-field display string.
 */
export function formatPartialDate(pd?: PartialDate): string {
  if (!pd) return '';
  if (pd.date) return pd.date;
  if (pd.year != null) return String(pd.year);
  return '';
}

/**
 * Compare two PartialDates for ordering.
 * Returns negative if a < b, 0 if equal/incomparable, positive if a > b.
 * Returns null if not enough info to compare.
 */
function comparePartialDates(a?: PartialDate, b?: PartialDate): number | null {
  if (!a || !b) return null;

  if (a.date && b.date) {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return 0;
  }

  if (a.year != null && b.year != null) {
    if (a.year < b.year) return -1;
    if (a.year > b.year) return 1;
    return 0;
  }

  return null;
}

/**
 * Validate birth <= death when both exist.
 */
export function validateBirthDeath(birth?: PartialDate, death?: PartialDate): string | null {
  const cmp = comparePartialDates(birth, death);
  if (cmp !== null && cmp > 0) {
    return 'Birth date must be before or equal to death date';
  }
  return null;
}
