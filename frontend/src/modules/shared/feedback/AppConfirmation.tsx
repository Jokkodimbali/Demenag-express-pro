import { useApp } from '../application/context';
import { ConfirmationDialog } from './ConfirmationDialog';

export function AppConfirmation() {
  const { confirmation, resolveConfirmation } = useApp();
  if (!confirmation) return null;
  return (
    <ConfirmationDialog
      {...confirmation}
      busy={false}
      error=""
      onConfirm={() => resolveConfirmation(true)}
      onClose={() => resolveConfirmation(false)}
    />
  );
}
