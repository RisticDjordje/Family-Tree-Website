export type PartialDate = {
  year?: number;
  date?: string; // YYYY-MM-DD
};

export type Person = {
  id: string;
  firstName: string;
  lastName?: string;
  birth?: PartialDate;
  death?: PartialDate;
  photoDataUrl?: string;
  parentIds: string[];
  siblingIds: string[]; // explicit sibling links (bidirectional)
  notes?: string;
};

export type FamilyData = {
  version: 1;
  updatedAt: string;
  people: Person[];
};
