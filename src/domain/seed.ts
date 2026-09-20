// 演示种子数据：覆盖 正常 / 待复核 / 已关闭冻结 / 关闭后补录 四种状态
import type { Closure, InspectionRecord, PersistedState, Reading, RecordVersion } from "./types";
import { SCHEMA_VERSION } from "./types";
import { deriveStatus, evaluateReading } from "./rules";
import { nowStamp } from "./time";

function version(
  no: number,
  reading: Reading,
  reason: string,
  createdAt: string
): RecordVersion {
  return { version: no, reading, reason, createdAt, triggeredRules: evaluateReading(reading) };
}

function record(
  room: string,
  area: string,
  versions: RecordVersion[],
  closures: Closure[] = []
): InspectionRecord {
  const rec: InspectionRecord = { id: room, room, area, status: "正常", versions, closures };
  rec.status = deriveStatus(rec);
  return rec;
}

export function seedState(): PersistedState {
  const records: InspectionRecord[] = [
    // 待复核：最新读数粒子超限，尚未补全处理备注
    record("CR-1201", "光刻间", [
      version(
        1,
        { isoClass: "ISO 5", particleCount: 2860, pressureDiff: 11.5, equipmentStatus: "运行", handlingNote: "" },
        "班前巡检",
        "2026-09-20 08:15:00"
      ),
      version(
        2,
        { isoClass: "ISO 5", particleCount: 4180, pressureDiff: 9.8, equipmentStatus: "运行", handlingNote: "" },
        "例行复测",
        "2026-09-20 10:40:00"
      ),
    ]),
    // 曾因负压关闭，补录复测正常后回到正常（版本链完整保留）
    record(
      "CR-2107",
      "刻蚀间",
      [
        version(
          1,
          { isoClass: "ISO 6", particleCount: 21400, pressureDiff: -2.4, equipmentStatus: "检修", handlingNote: "压差为负，已通知厂务检修空调箱" },
          "班前巡检",
          "2026-09-20 08:20:00"
        ),
        version(
          2,
          { isoClass: "ISO 6", particleCount: 19800, pressureDiff: 7.6, equipmentStatus: "运行", handlingNote: "检修后复测，压差恢复正常" },
          "补录：空调箱检修完成后复测",
          "2026-09-20 11:10:00"
        ),
      ],
      [{ version: 1, at: "2026-09-20 09:05:00" }]
    ),
    record("Y-0302", "黄光区", [
      version(
        1,
        { isoClass: "ISO 6", particleCount: 17300, pressureDiff: 6.2, equipmentStatus: "运行", handlingNote: "" },
        "班前巡检",
        "2026-09-20 08:25:00"
      ),
    ]),
    // 已关闭冻结：粒子超限，备注与停机状态齐备后关闭
    record(
      "CR-3102",
      "扩散间",
      [
        version(
          1,
          { isoClass: "ISO 7", particleCount: 386000, pressureDiff: 4.1, equipmentStatus: "停机", handlingNote: "粒子超限，已停机并通知厂务更换高效过滤器" },
          "班前巡检",
          "2026-09-20 08:30:00"
        ),
      ],
      [{ version: 1, at: "2026-09-20 09:20:00" }]
    ),
    record("CR-4501", "封装间", [
      version(
        1,
        { isoClass: "ISO 8", particleCount: 2410000, pressureDiff: 5.5, equipmentStatus: "运行", handlingNote: "" },
        "班前巡检",
        "2026-09-20 08:35:00"
      ),
    ]),
  ];
  return {
    schemaVersion: SCHEMA_VERSION,
    records,
    conflicts: [],
    drafts: {},
    savedAt: nowStamp(),
  };
}
