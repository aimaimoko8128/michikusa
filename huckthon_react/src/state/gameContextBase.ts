import { createContext } from 'react';
import type { GameEngine } from './useGameEngine';

export const GameContext = createContext<GameEngine | null>(null);
