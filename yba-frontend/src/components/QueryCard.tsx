import { FormEvent, ReactNode } from "react";
import Button from "./Button";
import { SheepMark } from "./Sheep";

interface Props {
  title: string;
  onSubmit: (e: FormEvent) => void;
  onReset?: () => void;
  submitLabel: string;
  preview: ReactNode;
  error?: string;
  children: ReactNode;
}

const QueryCard = ({ title, onSubmit, onReset, submitLabel, preview, error, children }: Props) => (
  <form className="query-card reveal" style={{ ["--d" as string]: "80ms" }} onSubmit={onSubmit} noValidate>
    <div className="query-card-header">
      <h2 className="query-card-title">{title}</h2>
      {onReset && (
        <button type="button" className="text-button" onClick={onReset}>
          Reset
        </button>
      )}
    </div>

    <div className="query-grid">{children}</div>

    <div className="query-card-footer">
      <div className="query-preview">
        <span className="query-preview-label">Your query</span>
        <p className="query-preview-text" key={String(preview)}>
          {preview}
        </p>
      </div>
      <Button type="submit" size="lg" arrow>
        {submitLabel}
      </Button>
    </div>

    {error && (
      <div className="query-error" role="alert">
        <SheepMark size={22} wool="currentColor" face="currentColor" />
        {error}
      </div>
    )}
  </form>
);

export default QueryCard;
