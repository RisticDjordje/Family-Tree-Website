# Family Tree

A local-only family tree web application. No cloud backend, no database — all data lives in a local `data/` folder as JSON files, auto-saved by the Vite dev server.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Where Is the Data?

All data is stored in the `data/` folder at the project root:

```
data/
├── family-tree.json          ← main data file (auto-loaded on startup, auto-saved on every change)
└── snapshots/
    ├── family.snapshot.2026-02-06_14-30-00.json
    ├── family.snapshot.2026-02-06_14-31-15.json
    └── ...                   ← timestamped snapshots saved before every change
```

- **`data/family-tree.json`** — the main file. Auto-loaded when the app starts, auto-saved whenever you make a change. This is your working data.
- **`data/snapshots/`** — safety snapshots. Before every mutation (add, edit, delete), the current state is saved here with a timestamp. If anything goes wrong, find the most recent snapshot and copy it over `family-tree.json`.

The `data/` folder is git-ignored by default. Back it up separately if needed.

## How It Works

### Auto-Save

Every time you add, edit, or delete a person, two things happen:
1. A timestamped snapshot of the **previous** state is saved to `data/snapshots/`
2. The **new** state is saved to `data/family-tree.json`

You never need to manually save. Just make your edits and the data is persisted.

### Import / Export

- **Export JSON**: Downloads a portable copy of your data as a `.json` file. Useful for backups or sharing.
- **Import JSON**: Loads a `.json` file into the app (replaces current data).

### Dirty Indicator

The sidebar shows "Unsaved Changes" when the current data differs from the last explicit export. This is about export status, not save status — data is always auto-saved.

## Usage

1. **Add people**: Click "+ Add Person" in the sidebar
2. **View tree**: The entire family tree is always visible on the canvas
3. **Focus**: Click a person in the sidebar to highlight and center them on the canvas
4. **Edit**: Click any node on the canvas to open the edit modal
5. **Connect family**: In the edit modal:
   - Select existing parents (up to 2) from the checkbox list
   - Click **+ Create New Parent** to add a new person and auto-link them as a parent
   - Click **+ Add Child** to create a child with this person as their parent
   - Click **+ Add Sibling** to create a sibling sharing the same parents
6. **Siblings**: Shown automatically — anyone sharing at least one parent
7. **Export**: Click "Export JSON" in the sidebar for a portable backup

## Data Model

```typescript
type PartialDate = { year?: number; date?: string };
type Person = {
  id: string;
  firstName: string;
  lastName?: string;
  birth?: PartialDate;
  death?: PartialDate;
  photoDataUrl?: string;
  parentIds: string[];
  notes?: string;
};
type FamilyData = { version: 1; updatedAt: string; people: Person[] };
```

## Validation Rules

- First name is required
- At most 2 parents per person
- No self-parenting
- No cycles (a descendant cannot be set as a parent)
- Date fields accept `YYYY` (year only) or `YYYY-MM-DD` (full date)
- Birth must be before or equal to death when both are provided

## Tech Stack

- React + TypeScript + Vite
- [React Flow (@xyflow/react)](https://reactflow.dev/) for the interactive tree canvas
- Vite dev server plugin for local file persistence
- No external UI library — minimal custom CSS
