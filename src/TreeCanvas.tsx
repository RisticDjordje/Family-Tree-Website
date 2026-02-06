import { useMemo, useEffect, useRef, useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Person } from './types';
import { PersonNode } from './PersonNode';

const nodeTypes = { person: PersonNode };

const NODE_W = 180;
const NODE_H = 80;
const GAP_H = 50;
const GAP_V = 140;

type TreeCanvasProps = {
  people: Person[];
  selectedId: string | null;
  onNodeClick: (id: string) => void;
};

// ---------------------------------------------------------------------------
// Layout algorithm
// ---------------------------------------------------------------------------

/** Assign each person a generation (layer). Roots = 0, children = max(parent gen)+1 */
function assignGenerations(people: Person[]): Map<string, number> {
  const idSet = new Set(people.map((p) => p.id));
  const personMap = new Map(people.map((p) => [p.id, p]));
  const gen = new Map<string, number>();

  function compute(id: string, visiting: Set<string>): number {
    if (gen.has(id)) return gen.get(id)!;
    if (visiting.has(id)) {
      gen.set(id, 0);
      return 0;
    } // cycle guard
    visiting.add(id);

    const person = personMap.get(id)!;
    const parents = person.parentIds.filter((pid) => idSet.has(pid));

    const g =
      parents.length > 0
        ? Math.max(...parents.map((pid) => compute(pid, visiting))) + 1
        : 0;

    gen.set(id, g);
    visiting.delete(id);
    return g;
  }

  for (const p of people) compute(p.id, new Set());
  return gen;
}

/** Average x position of a set of IDs. Returns 0 if none positioned yet. */
function avgX(ids: string[], xPos: Map<string, number>): number {
  const valid = ids.filter((id) => xPos.has(id));
  if (valid.length === 0) return 0;
  return valid.reduce((s, id) => s + xPos.get(id)!, 0) / valid.length;
}

/** Ensure no two nodes in a group are closer than minDist. Push right on collision. */
function resolveOverlaps(group: string[], xPos: Map<string, number>) {
  if (group.length <= 1) return;
  const sorted = [...group].sort((a, b) => xPos.get(a)! - xPos.get(b)!);
  const minDist = NODE_W + GAP_H;
  for (let i = 1; i < sorted.length; i++) {
    const prevX = xPos.get(sorted[i - 1])!;
    const currX = xPos.get(sorted[i])!;
    if (currX - prevX < minDist) {
      xPos.set(sorted[i], prevX + minDist);
    }
  }
}

/** Re-center a group so its midpoint is at 0 (or near its previous center). */
function centerGroup(group: string[], xPos: Map<string, number>) {
  if (group.length === 0) return;
  const xs = group.map((id) => xPos.get(id)!);
  const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
  for (const id of group) {
    xPos.set(id, xPos.get(id)! - mid);
  }
}

type LayoutResult = {
  positions: Map<string, { x: number; y: number }>;
  edges: Edge[];
};

function computeLayout(people: Person[]): LayoutResult {
  if (people.length === 0) return { positions: new Map(), edges: [] };

  const idSet = new Set(people.map((p) => p.id));
  const personMap = new Map(people.map((p) => [p.id, p]));

  // Build children lookup
  const childrenOf = new Map<string, string[]>();
  for (const p of people) {
    for (const pid of p.parentIds) {
      if (idSet.has(pid)) {
        if (!childrenOf.has(pid)) childrenOf.set(pid, []);
        childrenOf.get(pid)!.push(p.id);
      }
    }
  }

  const gens = assignGenerations(people);

  // Group by generation
  const groups = new Map<number, string[]>();
  for (const [id, g] of gens) {
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(id);
  }
  const layerKeys = [...groups.keys()].sort((a, b) => a - b);

  // ---- X positioning ----
  const xPos = new Map<string, number>();

  // Pass 1 (top-down): initial ordering by parent positions
  for (const key of layerKeys) {
    const group = groups.get(key)!;

    group.sort((a, b) => {
      const pa = personMap.get(a)!;
      const pb = personMap.get(b)!;
      const xA = avgX(
        pa.parentIds.filter((pid) => idSet.has(pid)),
        xPos,
      );
      const xB = avgX(
        pb.parentIds.filter((pid) => idSet.has(pid)),
        xPos,
      );
      if (xA !== xB) return xA - xB;
      // Stable fallback: alphabetical
      return `${pa.firstName}${pa.lastName ?? ''}`.localeCompare(
        `${pb.firstName}${pb.lastName ?? ''}`,
      );
    });

    for (let i = 0; i < group.length; i++) {
      xPos.set(group[i], i * (NODE_W + GAP_H));
    }
    centerGroup(group, xPos);
  }

  // Pass 2 (bottom-up): center each parent over its children
  for (const key of [...layerKeys].reverse()) {
    const group = groups.get(key)!;
    for (const id of group) {
      const ch = (childrenOf.get(id) ?? []).filter((cid) => xPos.has(cid));
      if (ch.length > 0) {
        const childXs = ch.map((cid) => xPos.get(cid)!);
        xPos.set(id, (Math.min(...childXs) + Math.max(...childXs)) / 2);
      }
    }
    resolveOverlaps(group, xPos);
  }

  // Pass 3 (top-down): pull children toward their parents
  for (const key of layerKeys) {
    const group = groups.get(key)!;
    for (const id of group) {
      const person = personMap.get(id)!;
      const validParents = person.parentIds.filter((pid) => xPos.has(pid));
      if (validParents.length > 0) {
        const parentAvg = avgX(validParents, xPos);
        const curr = xPos.get(id)!;
        xPos.set(id, curr * 0.3 + parentAvg * 0.7);
      }
    }
    resolveOverlaps(group, xPos);
  }

  // ---- Build results ----
  const positions = new Map<string, { x: number; y: number }>();
  for (const [id, x] of xPos) {
    positions.set(id, { x, y: (gens.get(id) ?? 0) * GAP_V });
  }

  const edges: Edge[] = [];
  for (const p of people) {
    for (const pid of p.parentIds) {
      if (idSet.has(pid)) {
        edges.push({
          id: `e-${pid}-${p.id}`,
          source: pid,
          target: p.id,
          type: 'smoothstep',
        });
      }
    }
  }

  return { positions, edges };
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

function TreeCanvasInner({ people, selectedId, onNodeClick }: TreeCanvasProps) {
  const { fitView, setCenter } = useReactFlow();

  const layout = useMemo(() => computeLayout(people), [people]);

  const nodes: Node[] = useMemo(
    () =>
      people.map((p) => ({
        id: p.id,
        type: 'person',
        position: layout.positions.get(p.id) ?? { x: 0, y: 0 },
        data: {
          person: p,
          highlighted: p.id === selectedId,
        },
      })),
    [people, layout, selectedId],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeClick(node.id);
    },
    [onNodeClick],
  );

  const edges = useMemo(() => layout.edges, [layout]);

  // Re-fit the view when nodes are added or removed
  const prevCount = useRef(people.length);
  useEffect(() => {
    if (people.length !== prevCount.current) {
      prevCount.current = people.length;
      const t = setTimeout(() => fitView({ padding: 0.2, duration: 250 }), 60);
      return () => clearTimeout(t);
    }
  }, [people.length, fitView]);

  // Center on selected person when sidebar selection changes
  useEffect(() => {
    if (!selectedId) return;
    const pos = layout.positions.get(selectedId);
    if (!pos) return;
    const t = setTimeout(() => {
      setCenter(pos.x + NODE_W / 2, pos.y + NODE_H / 2, {
        zoom: 1,
        duration: 300,
      });
    }, 60);
    return () => clearTimeout(t);
  }, [selectedId, layout, setCenter]);

  if (people.length === 0) {
    return (
      <div className="canvas-empty">
        <p>Add people using the sidebar to start building your family tree.</p>
      </div>
    );
  }

  return (
    <div className="canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function TreeCanvas(props: TreeCanvasProps) {
  return (
    <ReactFlowProvider>
      <TreeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
