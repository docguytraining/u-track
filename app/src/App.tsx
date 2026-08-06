import { useStore } from './store';
import { Onboarding } from './screens/Onboarding';
import { Home } from './screens/Home';
import { LogVoid } from './screens/LogVoid';
import { LogLeak } from './screens/LogLeak';
import { LogChange } from './screens/LogChange';
import { LogDrink } from './screens/LogDrink';
import { Morning } from './screens/Morning';
import { Report } from './screens/Report';
import { Detail } from './screens/Detail';
import { Settings } from './screens/Settings';

export function App() {
  const { onboarded, screen } = useStore();

  const body = !onboarded ? (
    <Onboarding />
  ) : screen === 'void' ? (
    <LogVoid />
  ) : screen === 'leak' ? (
    <LogLeak />
  ) : screen === 'change' ? (
    <LogChange />
  ) : screen === 'drink' ? (
    <LogDrink />
  ) : screen === 'morning' ? (
    <Morning />
  ) : screen === 'report' ? (
    <Report />
  ) : screen === 'detail' ? (
    <Detail />
  ) : screen === 'settings' ? (
    <Settings />
  ) : (
    <Home />
  );

  return <div className="app">{body}</div>;
}
