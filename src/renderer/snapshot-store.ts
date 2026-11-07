import { create } from 'zustand';
import type { Snapshot } from '../core/contracts';
export const useSnapshot = create<{
  snapshot: Snapshot | null;
  update: (snapshot: Snapshot) => void;
}>((set) => ({ snapshot: null, update: (snapshot) => set({ snapshot }) }));
