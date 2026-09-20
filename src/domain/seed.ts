// 示例数据：首次运行或落盘数据损坏时载入

import type { InspectionRecord } from "./types";

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

export function seedRecords(): InspectionRecord[] {
  return [
    {
      id: "CR-1201",
      room: "CR-1201 光刻间",
      status: "pending",
      closedVersion: null,
      versions: [
        {
          version: 1,
          reason: "首次巡检录入",
          createdAt: minutesAgo(180),
          readings: {
            isoClass: "ISO 5",
            particleCount: 4210,
            pressureDiff: 8,
            equipmentStatus: "运行",
            note: "",
          },
        },
      ],
    },
    {
      id: "CR-2107",
      room: "CR-2107 蚀刻间",
      status: "pending",
      closedVersion: null,
      versions: [
        {
          version: 1,
          reason: "首次巡检录入",
          createdAt: minutesAgo(150),
          readings: {
            isoClass: "ISO 6",
            particleCount: 18600,
            pressureDiff: -2.5,
            equipmentStatus: "运行",
            note: "",
          },
        },
      ],
    },
    {
      id: "Y-0302",
      room: "Y-0302 黄光区",
      status: "normal",
      closedVersion: null,
      versions: [
        {
          version: 1,
          reason: "首次巡检录入",
          createdAt: minutesAgo(120),
          readings: {
            isoClass: "ISO 7",
            particleCount: 128000,
            pressureDiff: 12,
            equipmentStatus: "运行",
            note: "",
          },
        },
      ],
    },
    {
      id: "CR-3305",
      room: "CR-3305 扩散间",
      status: "closed",
      closedVersion: 2,
      versions: [
        {
          version: 1,
          reason: "首次巡检录入",
          createdAt: minutesAgo(480),
          readings: {
            isoClass: "ISO 8",
            particleCount: 4120000,
            pressureDiff: 6,
            equipmentStatus: "运行",
            note: "",
          },
        },
        {
          version: 2,
          reason: "粒子超限复核：定位 HEPA 箱体泄漏",
          createdAt: minutesAgo(60),
          readings: {
            isoClass: "ISO 8",
            particleCount: 3980000,
            pressureDiff: 6,
            equipmentStatus: "停机",
            note: "HEPA 箱体泄漏，已停机安排更换，待复测",
          },
        },
      ],
    },
  ];
}
