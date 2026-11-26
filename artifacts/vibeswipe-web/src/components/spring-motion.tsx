import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

/** Overdamped spring: the motion slows into place and does not bounce back. */
export const WEIGHT_SPRING = { type: "spring" as const, stiffness: 280, damping: 38, mass: 1.1 };

/** Fast enough that a tab change settles in under a tenth of a second. */
export const ROUTE_SPRING = { type: "spring" as const, stiffness: 1200, damping: 48, mass: 0.35 };

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SpringDialog({
  open,
  onClose,
  onExited,
  label,
  children,
  panelClassName,
  className = "z-50",
}: {
  open: boolean;
  onClose: () => void;
  onExited?: () => void;
  label: string;
  children: ReactNode;
  panelClassName: string;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const focusable = () => [...(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    (focusable()[0] ?? panel)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus();
    };
  }, [open]);

  return (
    <AnimatePresence onExitComplete={onExited}>
      {open ? (
        <motion.div
          key="spring-dialog"
          className={`fixed inset-0 ${className} flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-5`}
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={WEIGHT_SPRING}
          onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            className={panelClassName}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={WEIGHT_SPRING}
            style={{ transformOrigin: "50% 100%" }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
