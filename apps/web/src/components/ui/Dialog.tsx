import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** 'center' = modal; 'right' | 'bottom' = painel lateral (Sheet) */
  variant?: 'center' | 'right' | 'bottom';
  className?: string;
}

/** Dialog/Sheet baseado no <dialog> nativo (foco preso, Esc fecha, acessível). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  variant = 'center',
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const pos =
    variant === 'center'
      ? 'm-auto max-w-lg rounded-2xl'
      : variant === 'right'
        ? 'ml-auto mr-0 my-0 h-dvh max-h-dvh w-[min(26rem,100vw)] rounded-l-2xl'
        : 'mb-0 mt-auto mx-auto w-full max-w-2xl rounded-t-2xl';

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className={cn(
        'w-[calc(100%-2rem)] border-2 border-line bg-surface p-0 text-ink shadow-hard backdrop:bg-[#14213d]/60 backdrop:backdrop-blur-[2px]',
        pos,
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b-2 border-line px-5 py-4">
        <h2 className="text-xl">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="grid size-9 place-items-center rounded-lg hover:bg-surface-2"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}

/** Atalho para Dialog como painel lateral. */
export function Sheet(props: Omit<DialogProps, 'variant'> & { side?: 'right' | 'bottom' }) {
  const { side = 'right', ...rest } = props;
  return <Dialog variant={side} {...rest} />;
}
