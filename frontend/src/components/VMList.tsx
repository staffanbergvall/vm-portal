import type { VMInfo } from '../services/api';
import { VMCard } from './VMCard';

interface VMListProps {
  vms: VMInfo[];
  onRefresh: () => void;
  selectedVMs?: Set<string>;
  onSelectionChange?: (vmName: string, selected: boolean) => void;
  selectionMode?: boolean;
}

export function VMList({ vms, onRefresh, selectedVMs, onSelectionChange, selectionMode = false }: VMListProps) {
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
        <VMCard
          key={vm.id}
          vm={vm}
          onActionComplete={onRefresh}
          isSelected={selectedVMs?.has(vm.name) ?? false}
          onSelectionChange={onSelectionChange}
          selectionMode={selectionMode}
        />
      ))}
    </div>
  );
}
