import { REVIEW_STATUS_LABEL, type ReviewStatus } from "../domain/types";

const BADGE_CLASS: Record<ReviewStatus, string> = {
  normal: "badge-ok",
  pending: "badge-danger",
  closed: "badge-muted",
};

export function StatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span className={`status-badge ${BADGE_CLASS[status]}`}>
      {REVIEW_STATUS_LABEL[status]}
    </span>
  );
}
