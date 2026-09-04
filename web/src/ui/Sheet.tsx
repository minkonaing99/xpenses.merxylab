import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import "./Sheet.css";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  dirty?: boolean;
}

/**
 * Bottom sheet. Mounts on open, animates in, unmounts after the leave
 * transition. Backdrop tap and Escape close. Body scroll locked while open.
 */
export function Sheet({ open, onClose, title, children, dirty = false }: Props) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const requestClose = useCallback(() => {
    if (!dirty || window.confirm("Discard unsaved changes?")) onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [mounted, requestClose]);

  if (!mounted) return null;

  return (
    <div
      className={`sheet${shown ? " is-shown" : ""}`}
      onTransitionEnd={(e) => {
        if (e.target === panelRef.current && !shown) setMounted(false);
      }}
    >
      <button className="sheet__scrim" aria-label="Close" onClick={requestClose} />
      <div className="sheet__panel" role="dialog" aria-modal="true" aria-label={title} ref={panelRef}>
        <div className="sheet__grip" aria-hidden="true" />
        <div className="sheet__head">
          <h2 className="sheet__title">{title}</h2>
          <button className="sheet__close" onClick={requestClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </div>
  );
}
