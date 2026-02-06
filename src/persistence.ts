import type { FamilyData } from './types';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Validate the shape of imported/loaded JSON data. Migrates older data missing siblingIds. */
export function validateFamilyData(obj: unknown): obj is FamilyData {
  if (typeof obj !== 'object' || obj === null) return false;
  const d = obj as Record<string, unknown>;
  if (d.version !== 1) return false;
  if (typeof d.updatedAt !== 'string') return false;
  if (!Array.isArray(d.people)) return false;
  for (const p of d.people) {
    if (typeof p !== 'object' || p === null) return false;
    const person = p as Record<string, unknown>;
    if (typeof person.id !== 'string') return false;
    if (typeof person.firstName !== 'string') return false;
    if (!Array.isArray(person.parentIds)) return false;
    // Migrate: add siblingIds if missing (older data format)
    if (!Array.isArray(person.siblingIds)) {
      person.siblingIds = [];
    }
  }
  return true;
}

/** Compute a simple hash string for dirty tracking. */
export function computeHash(data: FamilyData): string {
  return JSON.stringify(data.people);
}

// ---------------------------------------------------------------------------
// Server persistence (data/ folder via Vite plugin)
// ---------------------------------------------------------------------------

/** Load data from `data/family-tree.json` via the dev server API. */
export async function loadFromServer(): Promise<FamilyData | null> {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) return null;
    const obj = await res.json();
    if (validateFamilyData(obj)) return obj;
    return null;
  } catch {
    return null;
  }
}

/** Save data to `data/family-tree.json` via the dev server API. */
export async function saveToServer(data: FamilyData): Promise<void> {
  try {
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data, null, 2),
    });
  } catch {
    console.warn('Failed to save data to server.');
  }
}

/** Save a snapshot to `data/snapshots/` via the dev server API. */
export async function saveSnapshotToServer(data: FamilyData): Promise<void> {
  try {
    await fetch('/api/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data, null, 2),
    });
  } catch {
    console.warn('Failed to save snapshot to server.');
  }
}

// ---------------------------------------------------------------------------
// File-based import/export (browser downloads)
// ---------------------------------------------------------------------------

function downloadJson(data: string, filename: string): void {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

/** Download the current data as a portable JSON file. */
export function exportToFile(data: FamilyData): void {
  const json = JSON.stringify(data, null, 2);
  downloadJson(json, `family-tree.${timestamp()}.json`);
}

/** Read a file selected by the user and parse it as JSON. */
export function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string));
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
