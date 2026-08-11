/**
 * One coherent line-icon set for the log actions. All share the same visual language:
 * a single 1.75px rounded stroke on a 24×24 grid, drawn in `currentColor` so they take
 * the button's text color and adapt to light/dark for free. Emoji are deliberately
 * avoided — they render differently per platform and can't be kept on one design
 * language, and some carry connotations that don't fit a clinical tool. The urine
 * events share a droplet motif; the product events share a rounded "pad" motif.
 */
export type IconName = 'void' | 'drink' | 'leak' | 'wet' | 'change' | 'morning' | 'chart' | 'copy';

const GLYPHS: Record<IconName, React.ReactNode> = {
  // Drink — a tapered tumbler with a liquid line.
  drink: (
    <>
      <path d="M6 5h12l-1.1 13.2a2 2 0 0 1-2 1.8H9.1a2 2 0 0 1-2-1.8Z" />
      <path d="M6.7 10h10.6" />
    </>
  ),
  // Void — a single droplet (bladder emptied, into the toilet).
  void: <path d="M12 3.5c-3 4.2-6 7.4-6 10.5a6 6 0 0 0 12 0c0-3.1-3-6.3-6-10.5Z" />,
  // Leak — a droplet that escaped onto a surface (the line beneath it).
  leak: (
    <>
      <path d="M12 4c-2.5 3.5-5 6.2-5 8.7a5 5 0 0 0 10 0c0-2.5-2.5-5.2-5-8.7Z" />
      <path d="M5 20.5h14" />
    </>
  ),
  // Wet — a droplet going into the product (the rounded pad below it).
  wet: (
    <>
      <rect x="4.5" y="13" width="15" height="7.5" rx="3" />
      <path d="M12 3.5c-1.9 2.7-3.7 4.9-3.7 6.7a3.7 3.7 0 0 0 7.4 0c0-1.8-1.8-4-3.7-6.7Z" />
    </>
  ),
  // Change — swap the product: a two-arc refresh.
  change: (
    <>
      <path d="M4.6 9.2A7.5 7.5 0 0 1 17.3 5.7L20 8" />
      <path d="M20 3.8V8h-4.2" />
      <path d="M19.4 14.8A7.5 7.5 0 0 1 6.7 18.3L4 16" />
      <path d="M4 20.2V16h4.2" />
    </>
  ),
  // Morning check-in — a sunrise over the horizon.
  morning: (
    <>
      <path d="M4 18.5h16" />
      <path d="M7.5 18.5a4.5 4.5 0 0 1 9 0" />
      <path d="M12 6.5V8.3M6.2 9.2l1.2 1.2M17.8 9.2l-1.2 1.2M3.5 14h1.6M18.9 14h1.6" />
    </>
  ),
  // Chart — an axis with three bars (the frequency-volume chart).
  chart: (
    <>
      <path d="M4 20h16" />
      <path d="M7.5 20v-7M12 20V6M16.5 20v-4" />
    </>
  ),
  // Copy — two overlapping rounded sheets.
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
      <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
    </>
  ),
};

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ verticalAlign: '-0.2em', marginRight: 10, flexShrink: 0 }}
    >
      {GLYPHS[name]}
    </svg>
  );
}
