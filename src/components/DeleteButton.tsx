import { useEffect, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { Check, Trash2, X } from 'lucide-react';

/**
 * A delete that asks once, in place: the first press turns the button into a
 * filled "Confirm" with a cancel beside it, the second press deletes. Escape
 * or the cancel puts it back. Ported from the NativeDelete pattern to Sylvi's
 * own buttons and the motion package.
 */
export function DeleteButton({
  onDelete,
  onConfirm,
  label = 'Delete',
  confirmLabel = 'Confirm',
  iconOnly = false,
  disabled = false,
  className = ''
}: {
  /** Runs on the second press. */
  onDelete: () => void;
  /** Runs when the confirmation appears. */
  onConfirm?: () => void;
  label?: string;
  confirmLabel?: string;
  /** Shows only the bin until armed, for tight rows; the label stays as its accessible name. */
  iconOnly?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArmed(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [armed]);

  const press = () => {
    if (disabled) return;
    if (armed) {
      setArmed(false);
      onDelete();
    } else {
      setArmed(true);
      onConfirm?.();
    }
  };

  // Springs never bounce here; the icon swap is a short blur cross-fade.
  return (
    <MotionConfig transition={{ type: 'spring', bounce: 0, duration: 0.35 }} reducedMotion="user">
      <motion.span layout className={`delete-btn ${className}`.trim()}>
        <motion.button
          layout
          type="button"
          className={`btn btn--sm ${armed ? 'btn--confirm-delete' : 'btn--ghost btn--danger'}`}
          onClick={press}
          disabled={disabled}
          aria-label={armed ? `${confirmLabel}: ${label}` : label}
          whileTap={disabled ? undefined : { scale: 0.96 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={armed ? 'check' : 'bin'}
              className="delete-btn-icon"
              initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            >
              {armed ? <Check size={14} strokeWidth={2.2} /> : <Trash2 size={14} />}
            </motion.span>
          </AnimatePresence>
          {iconOnly && !armed ? null : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={armed ? 'confirm' : 'delete'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {armed ? confirmLabel : label}
              </motion.span>
            </AnimatePresence>
          )}
        </motion.button>

        <AnimatePresence mode="popLayout">
          {armed ? (
            <motion.button
              key="cancel"
              layout
              type="button"
              className="btn btn--sm btn--icon delete-btn-cancel"
              onClick={() => setArmed(false)}
              aria-label={`Keep it, don’t ${label.toLowerCase()}`}
              initial={{ opacity: 0, scale: 0.9, x: -6 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: -6 }}
              whileTap={{ scale: 0.96 }}
            >
              <X size={14} strokeWidth={2.2} />
            </motion.button>
          ) : null}
        </AnimatePresence>
      </motion.span>
    </MotionConfig>
  );
}
