import { useStore } from './store';
import { Onboarding } from './screens/Onboarding';
import { Home } from './screens/Home';
import { LogVoid } from './screens/LogVoid';
import { LogLeak } from './screens/LogLeak';
import { LogChange } from './screens/LogChange';
import { LogDrink } from './screens/LogDrink';
import { Morning } from './screens/Morning';
import { Report } from './screens/Report';
import { Chart } from './screens/Chart';
import { Detail } from './screens/Detail';
import { Settings } from './screens/Settings';
import { SignIn } from './screens/SignIn';

export function App() {
  const { onboarded, screen, authReady } = useStore();

  if (!authReady) {
    return (
      <div className="app">
        <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <span className="eyebrow">u-track</span>
        </div>
      </div>
    );
  }

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
  ) : screen === 'chart' ? (
    <Chart />
  ) : screen === 'detail' ? (
    <Detail />
  ) : screen === 'settings' ? (
    <Settings />
  ) : screen === 'signin' ? (
    <SignIn />
  ) : (
    <Home />
  );

  return <div className="app">{body}</div>;
}
