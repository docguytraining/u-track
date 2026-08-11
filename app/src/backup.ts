import type { LogEntry, Product } from './store';

/**
 * Your data, portable. Two exports: a human/spreadsheet CSV of every event (readable, and
 * printable for a clinician), and a full JSON backup you can restore on another device or
 * after clearing your browser. This is a local-first health tracker — getting your data
 * OUT (and back in) is a feature, not an afterthought.
 */

const csvCell = (s: string) => {
  let v = s ?? '';
  // Spreadsheet formula-injection guard: a product name or note like "=CMD()" or "+HYPERLINK(...)"
  // is executed as a formula when the CSV is opened in Excel/Sheets. Prefixing a value that
  // begins with = + - @ (or a control char) with an apostrophe makes the app treat it as literal
  // text. The export is health data people open in a spreadsheet, so this matters.
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

/** One flat, readable row per event — date, time, type, a plain summary, volume, product. */
export function eventsToCsv(entries: readonly LogEntry[], products: readonly Product[]): string {
  const name = (id: string | null) => products.find((p) => p.id === id)?.name ?? '';
  const rows: string[][] = [['date', 'time', 'type', 'detail', 'volume_ml', 'product']];
  const at = (e: LogEntry) => (e.kind === 'night' ? e.bedtime : e.at);
  const sorted = [...entries].sort((a, b) => at(a) - at(b));
  for (const e of sorted) {
    const d = new Date(at(e));
    let type: string = e.kind;
    let detail = '';
    let ml = '';
    let prod = '';
    if (e.kind === 'void') {
      type = e.leaked ? 'leak' : e.where === 'product' || e.where === 'both' ? 'wetting' : 'void';
      detail = [e.where ?? '', e.leaked ? 'leaked' : '', e.size ?? '', e.answers.urgency, e.answers.leakSeverity, e.answers.leakTrigger].filter(Boolean).join('; ');
      ml = e.volumeMl != null ? String(e.volumeMl) : '';
      prod = name(e.productId);
    } else if (e.kind === 'change') {
      detail = e.answers.fullness ?? '';
      ml = e.volumeMl != null ? String(e.volumeMl) : '';
      prod = name(e.productId);
    } else if (e.kind === 'drink') {
      detail = e.type;
      ml = e.volumeMl != null ? String(e.volumeMl) : '';
    } else if (e.kind === 'night') {
      detail = [e.answers.howWasNight, e.answers.wetDry, e.answers.nightVoids ? `${e.answers.nightVoids} trips` : '', e.answers.leakedThrough === 'Yes' ? 'leaked through' : ''].filter(Boolean).join('; ');
    }
    rows.push([d.toLocaleDateString('en-CA'), d.toLocaleTimeString([], { hour12: false }), type, detail, ml, prod]);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

/** The full restorable backup — every persisted field, versioned and timestamped. */
export interface Backup {
  app: 'u-track';
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}
export const buildBackup = (data: Record<string, unknown>, now: string): Backup => ({ app: 'u-track', version: 1, exportedAt: now, data });

/** Parse a backup file, tolerant of a bare data object or the wrapped form. Returns the
 * persisted `data` payload, or null if it doesn't look like ours. */
export function parseBackup(text: string): Record<string, unknown> | null {
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    const data = (obj.app === 'u-track' && obj.data ? obj.data : obj) as Record<string, unknown>;
    return Array.isArray((data as { entries?: unknown }).entries) ? data : null;
  } catch {
    return null;
  }
}

/** Trigger a browser download of some text content. */
export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** True when the app is running as an installed/home-screen PWA rather than a browser tab. */
function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

/**
 * Get the export file off the device. In an installed iOS PWA the `<a download>` trick is a
 * dead end — WebKit ignores the download attribute in standalone mode, so the file has no way
 * out. There the Web Share API (with a File) works: it opens the OS Share Sheet, letting the
 * user save to Files, mail it to their clinician, etc.
 *
 * We only prefer sharing in the standalone app. In a normal browser tab — including desktop
 * Chrome/Edge, where `canShare({files})` is also true — a plain download is the expected,
 * reliable behavior, and routing through the Share Sheet there would break the download users
 * get today (and silently no-op if they dismiss the sheet). So: share only where download fails.
 */
export async function shareOrDownload(filename: string, content: string, mime: string) {
  if (isStandaloneApp() && typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
    const file = new File([content], filename, { type: mime });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
      } catch {
        // User dismissed the Share Sheet, or it failed — do nothing rather than surprise them
        // with a download they didn't ask for.
      }
      return;
    }
  }
  download(filename, content, mime);
}
