import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import "./Sheet.css";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  dirty?: boolean;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
// Open sheets in open order; only the last one answers Escape. Closing sheets leave at once, not after their animation.
const openSheets: object[] = [];

export const isSheetOpen = () => openSheets.length > 0;

function wrapTab(event: React.KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "Tab") return;
  // ponytail: skips [hidden]/[inert] subtrees only; CSS visibility:hidden items still count.
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)]
    .filter((item) => !item.closest("[hidden], [inert]"));
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === event.currentTarget)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Bottom sheet. Mounts on open, animates in, unmounts after the leave
 * transition. Backdrop tap and Escape close. Body scroll locked while open.
 * Focus moves into the panel, Tab wraps inside it, and closing returns focus
 * to whatever was focused before opening.
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
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  useEffect(() => {
    const panel = panelRef.current;
    if (open && mounted && panel && !panel.contains(document.activeElement)) panel.focus();
  }, [open, mounted]);

  const closeRef = useRef(requestClose);
  useEffect(() => {
    closeRef.current = requestClose;
  }, [requestClose]);

  useEffect(() => {
    if (!open) return;
    const token = {};
    openSheets.push(token);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openSheets.at(-1) === token && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      openSheets.splice(openSheets.indexOf(token), 1);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    document.body.style.overflow = "hidden";
    return () => {
      if (!document.querySelector(".sheet")) document.body.style.overflow = "";
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      className={`sheet${shown ? " is-shown" : ""}`}
      onTransitionEnd={(e) => {
        if (e.target === panelRef.current && !shown) setMounted(false);
      }}
    >
      <button className="sheet__scrim" aria-label="Close" onClick={requestClose} />
      <div className="sheet__panel" role="dialog" aria-modal="true" aria-label={title} ref={panelRef}
        tabIndex={-1} onKeyDown={wrapTab}>
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
