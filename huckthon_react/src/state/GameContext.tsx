import type { ReactNode } from 'react';
import { useGameEngine } from './useGameEngine';
import { GameContext } from './gameContextBase';

export function GameProvider({ children }: { children: ReactNode }) {
  const engine = useGameEngine();
  return <GameContext.Provider value={engine}>{children}</GameContext.Provider>;
}
