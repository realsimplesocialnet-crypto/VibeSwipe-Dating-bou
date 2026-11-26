import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

/** Overdamped spring: the motion slows into place and does not bounce back. */
export const WEIGHT_SPRING = { type: "spring" as const, stiffness: 280, damping: 38, mass: 1.1 };

export function SpringDialog({
  open,
  onClose,
  onExited,
  children,
  panelClassName,
  className = "z-50",
}: {
  open: boolean;
  onClose: () => void;
  onExited?: () => void;
  children: ReactNode;
  panelClassName: string;
  className?: string;
}) {
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
