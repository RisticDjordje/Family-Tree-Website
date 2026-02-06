import { Handle, Position } from '@xyflow/react';
import type { Person } from './types';

export type PersonNodeData = {
  person: Person;
  highlighted?: boolean;
};

export function PersonNode({ data }: { data: PersonNodeData }) {
  const { person, highlighted } = data;

  const displayName = `${person.firstName} ${person.lastName ?? ''}`.trim();
  const years = [];
  if (person.birth?.year) years.push(`b. ${person.birth.year}`);
  if (person.death?.year) years.push(`d. ${person.death.year}`);

  return (
    <div className={`person-node${highlighted ? ' highlighted' : ''}`}>
      <Handle type="target" position={Position.Top} />
      {person.photoDataUrl && (
        <img
          src={person.photoDataUrl}
          alt={displayName}
          className="node-photo"
        />
      )}
      <div className="node-name">{displayName}</div>
      {years.length > 0 && (
        <div className="node-years">{years.join(' \u2014 ')}</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
