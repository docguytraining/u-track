import { describe, it, expect } from 'vitest';
import { selectScreen } from './routing';

/**
 * App routing is pure: given (authReady, onboarded, screen) → which screen renders.
 * This is where the "sign-in unreachable before onboarding" bug lived, so it gets tests.
 */
describe('selectScreen', () => {
  it('shows the splash until auth resolves', () => {
    expect(selectScreen({ authReady: false, onboarded: true, screen: 'home' })).toBe('splash');
  });

  it('REGRESSION: sign-in is reachable BEFORE onboarding (the log-in path from the welcome)', () => {
    expect(selectScreen({ authReady: true, onboarded: false, screen: 'signin' })).toBe('signin');
  });

  it('a not-onboarded user lands on onboarding (for any non-signin screen)', () => {
    expect(selectScreen({ authReady: true, onboarded: false, screen: 'home' })).toBe('onboarding');
    expect(selectScreen({ authReady: true, onboarded: false, screen: 'report' })).toBe('onboarding');
  });

  it('an onboarded user goes to the requested screen', () => {
    expect(selectScreen({ authReady: true, onboarded: true, screen: 'chart' })).toBe('chart');
    expect(selectScreen({ authReady: true, onboarded: true, screen: 'settings' })).toBe('settings');
    expect(selectScreen({ authReady: true, onboarded: true, screen: 'wet' })).toBe('wet');
  });

  it('an onboarded user with an unknown/home screen lands on home', () => {
    expect(selectScreen({ authReady: true, onboarded: true, screen: 'onboarding' })).toBe('home');
    expect(selectScreen({ authReady: true, onboarded: true, screen: 'home' })).toBe('home');
  });
});
