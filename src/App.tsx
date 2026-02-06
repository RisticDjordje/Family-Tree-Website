import { useState, useCallback, useEffect, useRef } from 'react';
import type { Person, FamilyData } from './types';
import {
  loadFromServer,
  saveToServer,
  saveSnapshotToServer,
  exportToFile,
  computeHash,
  validateFamilyData,
  readJsonFile,
} from './persistence';
import { Sidebar } from './Sidebar';
import { PersonModal, type ModalContext } from './PersonModal';
import { TreeCanvas } from './TreeCanvas';
import './App.css';

function emptyData(): FamilyData {
  return { version: 1, updatedAt: new Date().toISOString(), people: [] };
}

function App() {
  const [data, setData] = useState<FamilyData>(emptyData);
  const [baselineHash, setBaselineHash] = useState(() => computeHash(emptyData()));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editPersonId, setEditPersonId] = useState<string | null>(null);
  const [modalContext, setModalContext] = useState<ModalContext | undefined>();
  const [initialized, setInitialized] = useState(false);

  const dirty = computeHash(data) !== baselineHash;

  // Keep a ref to latest data for snapshot-before-mutation
  const dataRef = useRef(data);
  dataRef.current = data;

  // --- Auto-load from data/family-tree.json on startup ---
  useEffect(() => {
    loadFromServer().then((loaded) => {
      if (loaded) {
        setData(loaded);
        setBaselineHash(computeHash(loaded));
      }
      setInitialized(true);
    });
  }, []);

  // --- Auto-save to data/family-tree.json whenever data changes ---
  useEffect(() => {
    if (initialized) {
      saveToServer(data);
    }
  }, [data, initialized]);

  // --- Mutation wrapper ---
  const mutate = useCallback(
    (fn: (current: FamilyData) => FamilyData) => {
      // Snapshot current state before mutating (fire-and-forget)
      saveSnapshotToServer(dataRef.current);

      setData((prev) => {
        const next = fn(prev);
        return { ...next, updatedAt: new Date().toISOString() };
      });
    },
    [],
  );

  // --- Person operations ---
  const handleSavePerson = useCallback(
    (person: Person, ctx?: ModalContext) => {
      mutate((prev) => {
        const newPeople = [...prev.people];
        const idx = newPeople.findIndex((p) => p.id === person.id);
        if (idx >= 0) {
          newPeople[idx] = person;
        } else {
          newPeople.push(person);
        }

        // "Create New Parent" flow: link new person as parent of target
        if (ctx?.linkAsParentOf) {
          const targetIdx = newPeople.findIndex((p) => p.id === ctx.linkAsParentOf);
          if (targetIdx >= 0) {
            const target = newPeople[targetIdx];
            if (!target.parentIds.includes(person.id) && target.parentIds.length < 2) {
              newPeople[targetIdx] = {
                ...target,
                parentIds: [...target.parentIds, person.id],
              };
            }
          }
        }

        // "Add Sibling" flow: link new person as sibling of target
        if (ctx?.linkAsSiblingOf) {
          const targetIdx = newPeople.findIndex((p) => p.id === ctx.linkAsSiblingOf);
          if (targetIdx >= 0) {
            const target = newPeople[targetIdx];
            if (!target.siblingIds.includes(person.id)) {
              newPeople[targetIdx] = {
                ...target,
                siblingIds: [...target.siblingIds, person.id],
              };
            }
          }
          // Also add the reverse link on the new person
          const personIdx = newPeople.findIndex((p) => p.id === person.id);
          if (personIdx >= 0 && !newPeople[personIdx].siblingIds.includes(ctx.linkAsSiblingOf)) {
            newPeople[personIdx] = {
              ...newPeople[personIdx],
              siblingIds: [...newPeople[personIdx].siblingIds, ctx.linkAsSiblingOf],
            };
          }
        }

        // Sync bidirectional siblingIds: ensure if A lists B, B also lists A
        const personIdx = newPeople.findIndex((p) => p.id === person.id);
        if (personIdx >= 0) {
          const current = newPeople[personIdx];
          // For each sibling this person claims, add reverse link
          for (const sibId of current.siblingIds) {
            const sibIdx = newPeople.findIndex((p) => p.id === sibId);
            if (sibIdx >= 0 && !newPeople[sibIdx].siblingIds.includes(person.id)) {
              newPeople[sibIdx] = {
                ...newPeople[sibIdx],
                siblingIds: [...newPeople[sibIdx].siblingIds, person.id],
              };
            }
          }
          // For anyone who previously listed this person as sibling but is no longer in the list, remove reverse link
          for (const other of newPeople) {
            if (other.id === person.id) continue;
            if (other.siblingIds.includes(person.id) && !current.siblingIds.includes(other.id)) {
              const otherIdx = newPeople.findIndex((p) => p.id === other.id);
              newPeople[otherIdx] = {
                ...newPeople[otherIdx],
                siblingIds: newPeople[otherIdx].siblingIds.filter((sid) => sid !== person.id),
              };
            }
          }
        }

        return { ...prev, people: newPeople };
      });
      setModalMode(null);
      setEditPersonId(null);
      setModalContext(undefined);
    },
    [mutate],
  );

  const handleDeletePerson = useCallback(
    (id: string) => {
      mutate((prev) => {
        const newPeople = prev.people
          .filter((p) => p.id !== id)
          .map((p) => ({
            ...p,
            parentIds: p.parentIds.filter((pid) => pid !== id),
            siblingIds: p.siblingIds.filter((sid) => sid !== id),
          }));
        return { ...prev, people: newPeople };
      });
      if (selectedId === id) setSelectedId(null);
      setModalMode(null);
      setEditPersonId(null);
      setModalContext(undefined);
    },
    [mutate, selectedId],
  );

  // --- Import / Export ---
  const handleImport = useCallback(async (file: File) => {
    try {
      const obj = await readJsonFile(file);
      if (!validateFamilyData(obj)) {
        alert('Invalid family tree JSON format.');
        return;
      }
      setData(obj);
      setBaselineHash(computeHash(obj));
      setSelectedId(null);
    } catch {
      alert('Failed to read or parse the JSON file.');
    }
  }, []);

  const handleExport = useCallback(() => {
    exportToFile(data);
    setBaselineHash(computeHash(data));
  }, [data]);

  // --- Modal handlers ---
  const openAddModal = useCallback(() => {
    setEditPersonId(null);
    setModalContext(undefined);
    setModalMode('add');
  }, []);

  const openEditModal = useCallback((id: string) => {
    setEditPersonId(id);
    setModalContext(undefined);
    setModalMode('edit');
  }, []);

  const closeModal = useCallback(() => {
    setModalMode(null);
    setEditPersonId(null);
    setModalContext(undefined);
  }, []);

  const handleCreateParent = useCallback((forPersonId: string) => {
    setEditPersonId(null);
    setModalContext({ linkAsParentOf: forPersonId });
    setModalMode('add');
  }, []);

  const handleAddChild = useCallback((ofPersonId: string) => {
    setEditPersonId(null);
    setModalContext({ presetParentIds: [ofPersonId] });
    setModalMode('add');
  }, []);

  // "Add Sibling" flow: create a new person linked as sibling (+ copy parents if any)
  const handleAddSibling = useCallback(
    (ofPersonId: string) => {
      const person = data.people.find((p) => p.id === ofPersonId);
      if (!person) return;
      setEditPersonId(null);
      setModalContext({
        linkAsSiblingOf: ofPersonId,
        presetParentIds: person.parentIds.length > 0 ? [...person.parentIds] : undefined,
      });
      setModalMode('add');
    },
    [data.people],
  );

  const editPerson =
    modalMode === 'edit' && editPersonId
      ? data.people.find((p) => p.id === editPersonId) ?? null
      : null;

  const handleModalSave = useCallback(
    (person: Person) => {
      handleSavePerson(person, modalContext);
    },
    [handleSavePerson, modalContext],
  );

  return (
    <div className="app">
      <Sidebar
        people={data.people}
        selectedId={selectedId}
        dirty={dirty}
        onAddPerson={openAddModal}
        onSelectPerson={setSelectedId}
        onImport={handleImport}
        onExport={handleExport}
      />
      <main className="main">
        <TreeCanvas
          people={data.people}
          selectedId={selectedId}
          onNodeClick={openEditModal}
        />
      </main>
      {modalMode && (
        <PersonModal
          person={modalMode === 'edit' ? editPerson : null}
          people={data.people}
          context={modalContext}
          onSave={handleModalSave}
          onDelete={modalMode === 'edit' ? handleDeletePerson : undefined}
          onClose={closeModal}
          onCreateParent={handleCreateParent}
          onAddChild={handleAddChild}
          onAddSibling={handleAddSibling}
        />
      )}
    </div>
  );
}

export default App;
