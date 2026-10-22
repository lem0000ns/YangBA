import { ReactNode } from "react";
import { SheepMark } from "./Sheep";

interface Props {
  title: string;
  message?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "error";
}

/** Empty or error placeholder with title, message, and optional action. */
const EmptyState = ({ title, message, action, tone = "neutral" }: Props) => (
  <div className={`empty-state tone-${tone}`}>
    <div className="empty-state-mark" aria-hidden="true">
      <SheepMark size={64} wool="var(--wool-ink)" face="var(--ink)" />
    </div>
    <h2>{title}</h2>
    {message && <p>{message}</p>}
    {action && <div className="empty-state-action">{action}</div>}
  </div>
);

export default EmptyState;
