import type { VMInfo } from '../services/api';
import { VMCard } from './VMCard';

interface VMListProps {
  vms: VMInfo[];
  onRefresh: () => void;
}

export function VMList({ vms, onRefresh }: VMListProps) {
  if (vms.length === 0) {
    return (
      <div className="empty-state">
        <p>Inga virtuella maskiner hittades i resursgruppen.</p>
      </div>
    );
  }

  return (
    <div className="vm-grid">
      {vms.map((vm) => (
        <VMCard key={vm.id} vm={vm} onActionComplete={onRefresh} />
      ))}
    </div>
  );
}
