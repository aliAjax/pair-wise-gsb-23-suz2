// 领域数据：ISO 14644-1 洁净等级粒子浓度上限（≥0.5µm，个/m³）

import type { IsoClass } from "./types";

export const ISO_PARTICLE_LIMITS: Record<IsoClass, number> = {
  "ISO 5": 3520,
  "ISO 6": 35200,
  "ISO 7": 352000,
  "ISO 8": 3520000,
};

/** 压差规则说明（压差为负即异常） */
export const PRESSURE_RULE_LABEL = "压差不得为负（相对相邻区域）";
