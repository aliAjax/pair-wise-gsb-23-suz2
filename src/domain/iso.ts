import type { IsoClass } from "./types";

/** ISO 14644-1：≥0.5µm 粒子浓度上限（个/m³） */
export const ISO_PARTICLE_LIMITS: Record<IsoClass, number> = {
  "ISO 5": 3520,
  "ISO 6": 35200,
  "ISO 7": 352000,
  "ISO 8": 3520000,
};

export const ISO_CLASSES = Object.keys(ISO_PARTICLE_LIMITS) as IsoClass[];
