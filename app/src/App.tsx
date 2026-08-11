import { useEffect, useRef, type ReactElement } from 'react';
import { useStore } from './store';
import { selectScreen, type ScreenKey } from './routing';
import { Onboarding } from './screens/Onboarding';
import { Home } from './screens/Home';
import { LogVoid } from './screens/LogVoid';
import { LogLeak } from './screens/LogLeak';
import { LogChange } from './screens/LogChange';
import { LogDrink } from './screens/LogDrink';
import { Morning } from './screens/Morning';
import { Checkin } from './screens/Checkin';
import { Report } from './screens/Report';
import { Chart } from './screens/Chart';
import { Detail } from './screens/Detail';
import { Settings } from './screens/Settings';
import { SignIn } from './screens/SignIn';

const Splash = (
  <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
    <span className="eyebrow">u-track</span>
  </div>
);

export function App() {
  const { onboarded, screen, authReady } = useStore();
  const key = selectScreen({ authReady, onboarded, screen });
  const rootRef = useRef<HTMLDivElement>(null);

  // On each screen change, move focus to the new screen's heading. Without this a keyboard
  // user is dropped to <body> (restarting from the top) and a screen-reader user hears
  // nothing about the new screen. Focusing the heading announces the screen and anchors
  // keyboard focus. Headings carry no focus ring (the :focus-visible rule targets controls).
  useEffect(() => {
    const h = rootRef.current?.querySelector('h1, h2') as HTMLElement | null;
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: false }); }
  }, [key]);

  const screens: Record<ScreenKey, ReactElement> = {
    splash: Splash,
    signin: <SignIn />,
    onboarding: <Onboarding />,
    void: <LogVoid />,
    leak: <LogLeak />,
    change: <LogChange />,
    drink: <LogDrink />,
    morning: <Morning />,
    checkin: <Checkin />,
    report: <Report />,
    chart: <Chart />,
    detail: <Detail />,
    settings: <Settings />,
    home: <Home />,
  };

  return <div className="app" ref={rootRef}>{screens[key]}</div>;
}
