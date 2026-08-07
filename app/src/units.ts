// Volumes are stored in ml everywhere (the core math is ml-based); we only convert
// at the edges — display and the quick-size inputs. Weights stay in grams.
export type Units = 'ml' | 'oz';

export const ML_PER_OZ = 29.5735;

/** Format a stored ml value for display in the user's unit. */
export const fmtVol = (ml: number | null | undefined, units: Units): string => {
  if (ml == null) return '—';
  if (units === 'oz') {
    const oz = ml / ML_PER_OZ;
    return `${oz.toFixed(oz < 10 ? 1 : 0)} oz`;
  }
  return `${Math.round(ml)} ml`;
};

/** Quick-size presets, ml-native for ml and oz-native (stored as ml) for oz. */
export const VOID_SIZES: Record<Units, [string, number | null][]> = {
  ml: [['Small', 100], ['Medium', 250], ['Large', 400], ['Skip', null]],
  oz: [['Small', 118], ['Medium', 237], ['Large', 355], ['Skip', null]], // 4 / 8 / 12 oz
};

/** Drink-size presets as stored ml; the chip shows the amount in the user's unit. */
export const DRINK_SIZES: Record<Units, number[]> = {
  ml: [250, 500, 750, 1000, 1500],
  oz: [355, 591, 946, 1420, 1893], // 12 / 20 / 32 / 48 / 64 oz
};
