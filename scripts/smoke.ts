// 领域逻辑冒烟测试：规则引擎、复核闭环、冲突检测、落盘往返
import { evaluateAnomalies, canClose, deriveStatus, detectConflicts, repairRecords, latestVersion } from "../src/domain/rules";
import { draftFromRecord, draftDiffers, parseDraft } from "../src/domain/draft";
import { seedRecords } from "../src/domain/seed";
import { saveState, loadState, clearState } from "../src/domain/store";
import type { InspectionRecord } from "../src/domain/types";

let failures = 0;
function check(name: string, cond: boolean) {
  if (!cond) {
    failures++;
    console.error("FAIL:", name);
  } else {
    console.log("ok:", name);
  }
}

// ---- 异常判定 ----
check("粒子超限触发", evaluateAnomalies({ isoClass: "ISO 5", particleCount: 3521, pressureDiff: 5, equipmentStatus: "运行", note: "" }).some(h => h.ruleId === "particle-limit"));
check("粒子等于上限不触发", !evaluateAnomalies({ isoClass: "ISO 5", particleCount: 3520, pressureDiff: 5, equipmentStatus: "运行", note: "" }).some(h => h.ruleId === "particle-limit"));
check("负压差触发", evaluateAnomalies({ isoClass: "ISO 7", particleCount: 1, pressureDiff: -0.1, equipmentStatus: "运行", note: "" }).some(h => h.ruleId === "negative-pressure"));
check("零压差不触发", evaluateAnomalies({ isoClass: "ISO 7", particleCount: 1, pressureDiff: 0, equipmentStatus: "运行", note: "" }).length === 0);

// ---- 关闭条件 ----
check("备注+停机可关闭", canClose({ isoClass: "ISO 5", particleCount: 9999, pressureDiff: 1, equipmentStatus: "停机", note: "已处理" }));
check("备注+检修可关闭", canClose({ isoClass: "ISO 5", particleCount: 9999, pressureDiff: 1, equipmentStatus: "检修", note: "已处理" }));
check("运行中不可关闭", !canClose({ isoClass: "ISO 5", particleCount: 9999, pressureDiff: 1, equipmentStatus: "运行", note: "已处理" }));
check("无备注不可关闭", !canClose({ isoClass: "ISO 5", particleCount: 9999, pressureDiff: 1, equipmentStatus: "停机", note: "  " }));

// ---- 复核闭环生命周期 ----
const seed = seedRecords();
check("种子数据无冲突", detectConflicts(seed).length === 0);
check("种子含待复核/正常/已关闭", seed.some(r => r.status === "pending") && seed.some(r => r.status === "normal") && seed.some(r => r.status === "closed"));

// 模拟：待复核 → 保存处置读数 → 关闭 → 补录 → 回到待复核
const target = seed.find(r => r.id === "CR-1201")!;
const step1: InspectionRecord = {
  ...target,
  versions: [...target.versions, {
    version: 2,
    reason: "处置后复测",
    createdAt: new Date().toISOString(),
    readings: { isoClass: "ISO 5", particleCount: 4000, pressureDiff: 8, equipmentStatus: "检修", note: "更换 FFU 滤网" },
  }],
};
step1.status = deriveStatus(step1);
check("处置后仍超限→待复核", step1.status === "pending");
const step2: InspectionRecord = { ...step1, closedVersion: 2 };
check("满足条件+关闭标记→已关闭", deriveStatus(step2) === "closed");
const step3: InspectionRecord = {
  ...step2,
  versions: [...step2.versions, {
    version: 3,
    reason: "补录：复测数据更新",
    createdAt: new Date().toISOString(),
    readings: { isoClass: "ISO 5", particleCount: 3900, pressureDiff: 8, equipmentStatus: "检修", note: "更换 FFU 滤网" },
  }],
};
check("补录新版本后关闭失效→待复核", deriveStatus(step3) === "pending");
check("补录后旧值保留", step3.versions.length === 3 && latestVersion(step3).version === 3 && step2.versions[1].readings.particleCount === 4000);
const step4: InspectionRecord = {
  ...step3,
  versions: [...step3.versions.slice(0, 3), {
    version: 4,
    reason: "复测合格",
    createdAt: new Date().toISOString(),
    readings: { isoClass: "ISO 5", particleCount: 1200, pressureDiff: 9, equipmentStatus: "运行", note: "复测合格，恢复运行" },
  }],
};
check("读数恢复正常→正常", deriveStatus(step4) === "normal");

// ---- 冲突检测 ----
const tamperedNormal: InspectionRecord = {
  id: "X-1", room: "X-1 测试间", status: "normal", closedVersion: null,
  versions: [{ version: 1, reason: "录入", createdAt: new Date().toISOString(), readings: { isoClass: "ISO 5", particleCount: 99999, pressureDiff: -3, equipmentStatus: "运行", note: "" } }],
};
const conflicts1 = detectConflicts([tamperedNormal]);
check("异常标正常→2条冲突（粒子+压差）", conflicts1.length === 2);
check("冲突列出房间/读数/原值/新值/规则", conflicts1.every(c => c.room === "X-1 测试间" && c.field && c.storedValue && c.expectedValue && c.rule));

const tamperedClosed: InspectionRecord = {
  id: "X-2", room: "X-2 测试间", status: "closed", closedVersion: 1,
  versions: [{ version: 1, reason: "录入", createdAt: new Date().toISOString(), readings: { isoClass: "ISO 6", particleCount: 99999, pressureDiff: 5, equipmentStatus: "运行", note: "" } }],
};
const conflicts2 = detectConflicts([tamperedClosed]);
check("未满足条件却关闭→冲突", conflicts2.length === 1 && conflicts2[0].field === "关闭条件");

const tamperedChain: InspectionRecord = {
  id: "X-3", room: "X-3 测试间", status: "normal", closedVersion: null,
  versions: [
    { version: 1, reason: "录入", createdAt: new Date().toISOString(), readings: { isoClass: "ISO 7", particleCount: 1, pressureDiff: 5, equipmentStatus: "运行", note: "" } },
    { version: 3, reason: "", createdAt: new Date().toISOString(), readings: { isoClass: "ISO 7", particleCount: 2, pressureDiff: 5, equipmentStatus: "运行", note: "" } },
  ],
};
const conflicts3 = detectConflicts([tamperedChain]);
check("版本跳号+缺原因→2条版本链冲突", conflicts3.length === 2);

const repaired = repairRecords([tamperedNormal, tamperedClosed, tamperedChain]);
check("修复后无冲突", detectConflicts(repaired).length === 0);
check("修复后状态按规则推导", repaired[0].status === "pending" && repaired[1].status === "pending");

// ---- 草稿 ----
const draft = draftFromRecord(step2);
check("草稿底稿来自最新版本", !draftDiffers(step2, draft));
draft.note = "新备注";
check("改动后草稿为脏", draftDiffers(step2, draft));
check("非法粒子计数被拦截", !parseDraft({ ...draft, particleCount: "-5" }).ok);
check("空压差被拦截", !parseDraft({ ...draft, pressureDiff: "" }).ok);
check("负压差合法", (parseDraft({ ...draft, pressureDiff: "-2.5" }) as any).ok === true);

// ---- 落盘往返 ----
const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};
clearState();
const first = loadState();
check("无落盘→载入示例", first.source === "seed" && first.records.length === 4);
saveState(step3.versions ? seed.map(r => r.id === step3.id ? step3 : r) : seed, { "CR-1201": draft });
const second = loadState();
check("刷新后记录/状态/版本链一致", second.source === "storage"
  && second.records.find(r => r.id === "CR-1201")!.versions.length === 3
  && second.records.find(r => r.id === "CR-1201")!.status === "pending"
  && second.conflicts.length === 0);
check("草稿按房间恢复", Boolean(second.drafts["CR-1201"]) && second.drafts["CR-1201"].note === "新备注");

// 篡改落盘数据 → 冲突浮现
const raw = JSON.parse(store["hxwl-09.cleanroom.v1"]);
raw.records[2].status = "closed";
store["hxwl-09.cleanroom.v1"] = JSON.stringify(raw);
const third = loadState();
check("篡改状态→冲突被列出", third.conflicts.some(c => c.recordId === "Y-0302"));

// 损坏数据 → 回退示例
store["hxwl-09.cleanroom.v1"] = "{broken json";
const fourth = loadState();
check("损坏数据→回退示例", fourth.source === "recovered" && fourth.records.length === 4);

console.log(failures === 0 ? "\n全部通过" : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
