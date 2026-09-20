# hxwl-09 半导体洁净室巡检

洁净等级阈值、粒子计数与异常处理看板 —— 可落盘的复核闭环。

## 技术栈

React + Vite + TypeScript + CSS（无额外依赖）

## 本地运行

```bash
npm install
npm run dev
```

开发端口：5109

## 复核闭环规则

- 巡检记录包含：房间、洁净等级、粒子计数（≥0.5µm，个/m³）、压差（Pa）、设备状态、处理备注
- **异常待复核**：粒子计数超过所选 ISO 等级上限（ISO 14644-1），或压差为负
- **关闭条件**：处理备注已填写，且设备状态为「停机」或「检修」；关闭后读数冻结
- **补录**：已关闭记录只能补录 —— 必须填写原因，生成新版本，旧值保留在版本链中；补录后关闭标记自动失效，按新读数重新判定
- **草稿隔离**：未保存草稿按房间存放，切换房间不串台，刷新后仍在
- **落盘一致**：记录、复核状态、版本链持久化到 localStorage；刷新后重算校验，冲突时列出房间、读数、原值、新值和触发规则，可一键按规则修复

## 目录结构

```
src/
  domain/            # 领域层（无 React 依赖）
    types.ts         #   领域模型：记录、版本、复核状态、冲突
    isoLimits.ts     #   领域数据：ISO 14644-1 粒子上限
    rules.ts         #   校验规则：异常判定、关闭条件、状态推导、冲突检测与修复
    draft.ts         #   草稿模型与保存前解析校验
    seed.ts          #   示例数据
    store.ts         #   localStorage 落盘：结构校验、损坏回退
  state/
    useInspectionStore.ts  # 状态层：记录/草稿/冲突与全部写操作
  components/        # 界面层：指标卡、房间列表、记录详情、版本链、冲突面板
scripts/
  smoke.ts           # 领域逻辑冒烟测试（31 项断言）
```

## 验证

```bash
npm run build        # 构建
npx tsc --noEmit     # 类型检查（需本地有 @types/react）
# 领域逻辑冒烟测试：
npx tsc scripts/smoke.ts src/domain/*.ts --outDir /tmp/smoke-build \
  --module commonjs --target es2020 --moduleResolution node \
  --esModuleInterop --skipLibCheck --strict
node /tmp/smoke-build/scripts/smoke.js
```
