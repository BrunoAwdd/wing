import { Paragraph } from "../hooks/useWordInteraction";

export type ChangeStatus = "pending" | "accepted";

export interface Change {
  id: string;
  original: Paragraph;
  suggestion: Paragraph;
  status: ChangeStatus;
}

let pendingChanges: Record<string, Change> = {};

export const addOrUpdateChange = (change: Change): void => {
  pendingChanges[change.id] = change;
};

export const getChanges = (): Change[] => {
  return Object.values(pendingChanges);
};

export const getChange = (id: string): Change | undefined => {
  return pendingChanges[id];
};

export const updateChangeStatus = (id: string, status: ChangeStatus): void => {
  if (pendingChanges[id]) {
    pendingChanges[id].status = status;
  }
};

export const removeChange = (id: string): void => {
  delete pendingChanges[id];
};

export const clearAllPendingChanges = (): void => {
  pendingChanges = {};
};
