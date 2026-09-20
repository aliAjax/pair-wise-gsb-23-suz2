import type { ReviewStatus } from "../domain/types";

const BADGE_CLASS: Record<ReviewStatus, string> = {
  正常: "badge-ok",
  待复核: "badge-warn",
  已关闭: "badge-closed",
};

export function StatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={`badge ${BADGE_CLASS[status]}`}>{status}</span>;
}
