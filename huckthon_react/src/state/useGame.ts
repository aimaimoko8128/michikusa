import { useContext } from 'react';
import type { GameEngine } from './useGameEngine';
import { GameContext } from './gameContextBase';

export function useGame(): GameEngine {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
}
