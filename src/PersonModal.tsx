import { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Person } from './types';
import {
  wouldCreateCycle,
  parseDateInput,
  formatPartialDate,
  validateBirthDeath,
} from './validation';
import { resizePhoto } from './photoUtils';

export type ModalContext = {
  /** If set, the new person being created will be auto-linked as a parent of this person. */
  linkAsParentOf?: string;
  /** If set, these IDs are pre-selected as parents of the new person. */
  presetParentIds?: string[];
  /** If set, the new person will be explicitly linked as a sibling of this person. */
  linkAsSiblingOf?: string;
};

type PersonModalProps = {
  person: Person | null; // null = add mode
  people: Person[];
  context?: ModalContext;
  onSave: (person: Person) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  onCreateParent?: (forPersonId: string) => void;
  onAddChild?: (ofPersonId: string) => void;
  onAddSibling?: (ofPersonId: string) => void;
};

export function PersonModal({
  person,
  people,
  context,
  onSave,
  onDelete,
  onClose,
  onCreateParent,
  onAddChild,
  onAddSibling,
}: PersonModalProps) {
  const isEdit = person !== null;

  const [firstName, setFirstName] = useState(person?.firstName ?? '');
  const [lastName, setLastName] = useState(person?.lastName ?? '');
  const [birthInput, setBirthInput] = useState(formatPartialDate(person?.birth));
  const [deathInput, setDeathInput] = useState(formatPartialDate(person?.death));
  const [notes, setNotes] = useState(person?.notes ?? '');
  const [photoDataUrl, setPhotoDataUrl] = useState(person?.photoDataUrl ?? '');
  const [parentIds, setParentIds] = useState<string[]>(
    person?.parentIds ?? context?.presetParentIds ?? [],
  );
  const [siblingIds, setSiblingIds] = useState<string[]>(person?.siblingIds ?? []);
  const [errors, setErrors] = useState<string[]>([]);

  const personId = useMemo(() => person?.id ?? uuidv4(), [person]);

  // Who is this person being linked as a parent of?
  const linkTarget = context?.linkAsParentOf
    ? people.find((p) => p.id === context.linkAsParentOf)
    : null;

  // Derived children
  const children = useMemo(() => {
    return people.filter((p) => p.parentIds.includes(personId));
  }, [people, personId]);

  // All siblings: merge explicit (siblingIds) + derived (shared parents)
  const allSiblingIds = useMemo(() => {
    const ids = new Set(siblingIds);
    // Add derived siblings (share at least one parent)
    if (parentIds.length > 0) {
      for (const p of people) {
        if (p.id !== personId && p.parentIds.some((pid) => parentIds.includes(pid))) {
          ids.add(p.id);
        }
      }
    }
    return ids;
  }, [people, personId, parentIds, siblingIds]);

  const siblings = useMemo(() => {
    return people.filter((p) => allSiblingIds.has(p.id));
  }, [people, allSiblingIds]);

  // Available parents: exclude self and descendants
  const availableParents = useMemo(() => {
    return people.filter((p) => {
      if (p.id === personId) return false;
      return !wouldCreateCycle(personId, p.id, people);
    });
  }, [people, personId]);

  // Available people to link as explicit siblings: exclude self and already-linked
  const availableSiblings = useMemo(() => {
    return people.filter(
      (p) => p.id !== personId && !allSiblingIds.has(p.id),
    );
  }, [people, personId, allSiblingIds]);

  // Can add parents? (max 2)
  const canAddNewParent = isEdit && parentIds.length < 2;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const dataUrl = await resizePhoto(file);
        setPhotoDataUrl(dataUrl);
      } catch (err) {
        console.error('Failed to process photo:', err);
      }
    }
  };

  const handleParentToggle = (id: string) => {
    setParentIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((pid) => pid !== id);
      }
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  };

  const handleSiblingToggle = (id: string) => {
    setSiblingIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((sid) => sid !== id);
      }
      return [...prev, id];
    });
  };

  const handleRemoveExplicitSibling = (id: string) => {
    setSiblingIds((prev) => prev.filter((sid) => sid !== id));
  };

  const buildPerson = (): Person | null => {
    const errs: string[] = [];

    if (!firstName.trim()) {
      errs.push('First name is required');
    }

    const birthResult = parseDateInput(birthInput);
    if (birthResult.error) errs.push(`Birth: ${birthResult.error}`);

    const deathResult = parseDateInput(deathInput);
    if (deathResult.error) errs.push(`Death: ${deathResult.error}`);

    if (!birthResult.error && !deathResult.error) {
      const bdErr = validateBirthDeath(birthResult.value, deathResult.value);
      if (bdErr) errs.push(bdErr);
    }

    if (errs.length > 0) {
      setErrors(errs);
      return null;
    }

    return {
      id: personId,
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      birth: birthResult.value,
      death: deathResult.value,
      photoDataUrl: photoDataUrl || undefined,
      parentIds,
      siblingIds,
      notes: notes.trim() || undefined,
    };
  };

  const handleSave = () => {
    const saved = buildPerson();
    if (saved) onSave(saved);
  };

  const handleCreateParent = () => {
    const saved = buildPerson();
    if (!saved) return;
    onSave(saved);
    onCreateParent?.(personId);
  };

  const handleAddChild = () => {
    const saved = buildPerson();
    if (!saved) return;
    onSave(saved);
    onAddChild?.(personId);
  };

  const handleAddSibling = () => {
    const saved = buildPerson();
    if (!saved) return;
    onSave(saved);
    onAddSibling?.(personId);
  };

  // Close on escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Modal title
  let title = isEdit ? 'Edit Person' : 'Add Person';
  if (linkTarget) {
    title = `Add Parent of ${linkTarget.firstName} ${linkTarget.lastName ?? ''}`.trim();
  }
  if (context?.presetParentIds?.length) {
    const parentNames = context.presetParentIds
      .map((id) => people.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => p!.firstName)
      .join(' & ');
    if (parentNames) {
      title = `Add Child of ${parentNames}`;
    }
  }
  if (context?.linkAsSiblingOf) {
    const sib = people.find((p) => p.id === context.linkAsSiblingOf);
    if (sib) {
      title = `Add Sibling of ${sib.firstName} ${sib.lastName ?? ''}`.trim();
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {errors.length > 0 && (
          <div className="errors">
            {errors.map((err, i) => (
              <p key={i}>{err}</p>
            ))}
          </div>
        )}

        <div className="modal-body">
          <div className="form-row">
            <label>
              First Name *
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
              />
            </label>
            <label>
              Last Name
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Born
              <input
                type="text"
                value={birthInput}
                onChange={(e) => setBirthInput(e.target.value)}
                placeholder="YYYY or YYYY-MM-DD"
              />
            </label>
            <label>
              Died
              <input
                type="text"
                value={deathInput}
                onChange={(e) => setDeathInput(e.target.value)}
                placeholder="YYYY or YYYY-MM-DD"
              />
            </label>
          </div>

          <label>
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </label>

          <label>
            Photo
            <input type="file" accept="image/*" onChange={handlePhotoUpload} />
          </label>
          {photoDataUrl && (
            <div className="photo-preview">
              <img src={photoDataUrl} alt="Preview" />
              <button
                className="btn btn-small"
                onClick={() => setPhotoDataUrl('')}
              >
                Remove Photo
              </button>
            </div>
          )}

          <div className="parents-section">
            <div className="section-header">
              <h3>Parents{parentIds.length > 0 ? ` (${parentIds.length}/2)` : ''}</h3>
              {canAddNewParent && onCreateParent && (
                <button
                  className="btn btn-small btn-outline"
                  onClick={handleCreateParent}
                >
                  + Create New Parent
                </button>
              )}
            </div>
            {availableParents.length === 0 && parentIds.length === 0 && (
              <p className="empty-message">
                No people to select as parents.
                {!isEdit && ' Save this person first, then add parents.'}
              </p>
            )}
            {availableParents.length > 0 && (
              <div className="parent-select-list">
                {availableParents.map((p) => (
                  <label key={p.id} className="parent-option">
                    <input
                      type="checkbox"
                      checked={parentIds.includes(p.id)}
                      onChange={() => handleParentToggle(p.id)}
                      disabled={
                        !parentIds.includes(p.id) && parentIds.length >= 2
                      }
                    />
                    {p.firstName} {p.lastName ?? ''}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="children-section">
            <div className="section-header">
              <h3>Children{children.length > 0 ? ` (${children.length})` : ''}</h3>
              {isEdit && onAddChild && (
                <button
                  className="btn btn-small btn-outline"
                  onClick={handleAddChild}
                >
                  + Add Child
                </button>
              )}
            </div>
            {children.length > 0 ? (
              <ul>
                {children.map((c) => (
                  <li key={c.id}>
                    {c.firstName} {c.lastName ?? ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-message">
                No children.
                {!isEdit && ' Save this person first, then add children.'}
              </p>
            )}
          </div>

          <div className="siblings-section">
            <div className="section-header">
              <h3>Siblings{siblings.length > 0 ? ` (${siblings.length})` : ''}</h3>
              {isEdit && onAddSibling && (
                <button
                  className="btn btn-small btn-outline"
                  onClick={handleAddSibling}
                >
                  + Add Sibling
                </button>
              )}
            </div>
            {siblings.length > 0 && (
              <ul>
                {siblings.map((s) => {
                  const isDerived =
                    parentIds.length > 0 &&
                    s.parentIds.some((pid) => parentIds.includes(pid));
                  const isExplicit = siblingIds.includes(s.id);
                  return (
                    <li key={s.id} className="sibling-item">
                      <span>
                        {s.firstName} {s.lastName ?? ''}
                        {isDerived && !isExplicit && (
                          <span className="sibling-tag derived">shared parent</span>
                        )}
                        {isExplicit && (
                          <span className="sibling-tag explicit">linked</span>
                        )}
                      </span>
                      {isExplicit && (
                        <button
                          className="btn-remove"
                          onClick={() => handleRemoveExplicitSibling(s.id)}
                          title="Remove sibling link"
                        >
                          &times;
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {siblings.length === 0 && (
              <p className="empty-message">No siblings.</p>
            )}
            {availableSiblings.length > 0 && (
              <details className="link-sibling-details">
                <summary>Link existing person as sibling</summary>
                <div className="parent-select-list">
                  {availableSiblings.map((p) => (
                    <label key={p.id} className="parent-option">
                      <input
                        type="checkbox"
                        checked={siblingIds.includes(p.id)}
                        onChange={() => handleSiblingToggle(p.id)}
                      />
                      {p.firstName} {p.lastName ?? ''}
                    </label>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>

        <div className="modal-footer">
          {isEdit && onDelete && (
            <button
              className="btn btn-danger"
              onClick={() => onDelete(personId)}
            >
              Delete
            </button>
          )}
          <div className="modal-footer-right">
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
