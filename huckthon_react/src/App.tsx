import { GameProvider } from './state/GameContext';
import { useGame } from './state/useGame';
import { HeroScreen } from './screens/HeroScreen';
import { SetupScreen } from './screens/SetupScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { QuizScreen } from './screens/QuizScreen';
import { RevealScreen } from './screens/RevealScreen';
import { GroupMenuScreen } from './screens/GroupMenuScreen';
import { GroupWaitScreen } from './screens/GroupWaitScreen';
import { GroupResultScreen } from './screens/GroupResultScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import './App.css';

function Screens() {
  const { screen } = useGame();
  switch (screen) {
    case 'hero':
      return <HeroScreen />;
    case 'setup':
      return <SetupScreen />;
    case 'loading':
      return <LoadingScreen />;
    case 'quiz':
      return <QuizScreen />;
    case 'reveal':
      return <RevealScreen />;
    case 'group-menu':
      return <GroupMenuScreen />;
    case 'group-wait':
      return <GroupWaitScreen />;
    case 'group-result':
      return <GroupResultScreen />;
    case 'history':
      return <HistoryScreen />;
    default:
      return null;
  }
}

function App() {
  return (
    <GameProvider>
      <div id="app">
        <Screens />
      </div>
    </GameProvider>
  );
}

export default App;
