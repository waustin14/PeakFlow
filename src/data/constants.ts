export const SHEET_FLOW_MANNINGS_N: Record<string, { label: string; n: number }> = {
  smooth_surfaces: { label: 'Smooth surfaces (concrete, asphalt, gravel)', n: 0.011 },
  fallow_no_residue: { label: 'Fallow (no residue)', n: 0.05 },
  cultivated_residue_lt20: { label: 'Cultivated soils, residue cover ≤20%', n: 0.06 },
  cultivated_residue_gt20: { label: 'Cultivated soils, residue cover >20%', n: 0.17 },
  grass_short: { label: 'Grass, short grass prairie or lawns', n: 0.15 },
  grass_dense: { label: 'Grass, dense grasses', n: 0.24 },
  grass_bermuda: { label: 'Grass, bermudagrass', n: 0.41 },
  range_natural: { label: 'Range, natural', n: 0.13 },
  woods_light: { label: 'Woods, light underbrush', n: 0.40 },
  woods_dense: { label: 'Woods, dense underbrush', n: 0.80 },
}

export const CHANNEL_MANNINGS_N: Record<string, { label: string; n: number }> = {
  clean_straight: { label: 'Clean, straight channel', n: 0.030 },
  clean_winding: { label: 'Clean, winding channel', n: 0.040 },
  sluggish_deep: { label: 'Sluggish reaches, deep pools', n: 0.070 },
  grassy_floodway: { label: 'Grassy floodway', n: 0.035 },
  concrete_lined: { label: 'Concrete-lined', n: 0.015 },
  rock_cut: { label: 'Rock-cut channel', n: 0.035 },
  riprap_lined: { label: 'Riprap-lined', n: 0.035 },
  vegetated_swale: { label: 'Vegetated swale', n: 0.050 },
}

export const SHALLOW_FLOW_CONSTANTS = {
  unpaved: 16.1345,
  paved: 20.3282,
} as const

export const FP_VALUES: Array<{ percentPondingSwamp: number; Fp: number }> = [
  { percentPondingSwamp: 0, Fp: 1.00 },
  { percentPondingSwamp: 0.2, Fp: 0.97 },
  { percentPondingSwamp: 1.0, Fp: 0.87 },
  { percentPondingSwamp: 3.0, Fp: 0.75 },
  { percentPondingSwamp: 5.0, Fp: 0.72 },
]

export const SHEET_FLOW_MAX_LENGTH_FT = 300
