import { ReactNode, useEffect } from "react";
import { CloseIcon } from "./Icons";

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  variant?: "dialog" | "drawer";
}

/** Overlay dialog or drawer with escape-to-close and body scroll lock. */
const Modal = ({ open, onClose, title, eyebrow, children, variant = "dialog" }: Props) => {
  useEffect(() => {
    if (!open) return;
    /** Closes the modal when Escape is pressed. */
    const onKey = (e: KeyboardEvent) => e.key == "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("has-overlay");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("has-overlay");
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={`overlay overlay-${variant}`} onMouseDown={onClose}>
      <div
        className={`modal modal-${variant}`}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2 className="modal-title">{title}</h2>
          </div>
          <button type="button" className="nav-icon-button" onClick={onClose} aria-label="Close">
            <CloseIcon size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
