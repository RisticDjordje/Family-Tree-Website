import { useRef } from 'react';
import type { Person } from './types';

type SidebarProps = {
  people: Person[];
  selectedId: string | null;
  dirty: boolean;
  onAddPerson: () => void;
  onSelectPerson: (id: string) => void;
  onImport: (file: File) => void;
  onExport: () => void;
};

export function Sidebar({
  people,
  selectedId,
  dirty,
  onAddPerson,
  onSelectPerson,
  onImport,
  onExport,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = '';
    }
  };

  const sorted = [...people].sort((a, b) => {
    const nameA = `${a.firstName} ${a.lastName ?? ''}`.toLowerCase();
    const nameB = `${b.firstName} ${b.lastName ?? ''}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Family Tree</h2>
        {dirty && <span className="dirty-indicator">Unsaved Changes</span>}
      </div>

      <button className="btn btn-primary" onClick={onAddPerson}>
        + Add Person
      </button>

      <div className="people-list">
        {sorted.length === 0 && (
          <p className="empty-message">No people added yet.</p>
        )}
        {sorted.map((person) => (
          <button
            key={person.id}
            className={`person-item ${person.id === selectedId ? 'active' : ''}`}
            onClick={() => onSelectPerson(person.id)}
          >
            <span className="person-name">
              {person.firstName} {person.lastName ?? ''}
            </span>
            {person.birth?.year && (
              <span className="person-year">b. {person.birth.year}</span>
            )}
          </button>
        ))}
      </div>

      <div className="sidebar-actions">
        <button className="btn btn-secondary" onClick={handleImportClick}>
          Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button className="btn btn-secondary" onClick={onExport}>
          Export JSON
        </button>
      </div>
    </aside>
  );
}
