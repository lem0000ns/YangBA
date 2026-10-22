import { ReactNode } from "react";

interface Props {
  title?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}

/** Bordered section for results with optional header and actions. */
const ResultCard = ({ title, eyebrow, actions, children, className = "", flush = false }: Props) => (
  <section className={`result-card reveal ${flush ? "is-flush" : ""} ${className}`}>
    {(title || eyebrow || actions) && (
      <header className="result-card-header">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          {title && <h3 className="result-card-title">{title}</h3>}
        </div>
        {actions && <div className="result-card-actions">{actions}</div>}
      </header>
    )}
    <div className="result-card-body">{children}</div>
  </section>
);

export default ResultCard;
