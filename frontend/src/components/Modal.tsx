import { useEffect, useRef, type ReactNode } from 'react';
export function Modal({
  titleId,
  onClose,
  busy,
  children,
  className = 'account-dialog',
}: {
  titleId: string;
  onClose: () => void;
  busy: boolean;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
