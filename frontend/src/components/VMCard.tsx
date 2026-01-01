import { useState } from 'react';
import type { VMInfo } from '../services/api';
import { startVM, stopVM, restartVM } from '../services/api';
import { StatusBadge } from './StatusBadge';

interface VMCardProps {
  vm: VMInfo;
  onActionComplete: () => void;
  isSelected?: boolean;
  onSelectionChange?: (vmName: string, selected: boolean) => void;
  selectionMode?: boolean;
}

export function VMCard({ vm, onActionComplete, isSelected = false, onSelectionChange, selectionMode = false }: VMCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRunning = vm.powerState.toLowerCase() === 'running';
  const isStopped = ['stopped', 'deallocated'].includes(vm.powerState.toLowerCase());
  const isTransitioning = ['starting', 'stopping', 'deallocating'].includes(vm.powerState.toLowerCase());

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      await startVM(vm.name);
      onActionComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte starta VM');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!confirm(`Är du säker på att du vill stoppa ${vm.name}?`)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await stopVM(vm.name);
      onActionComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte stoppa VM');
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    if (!confirm(`Är du säker på att du vill starta om ${vm.name}?`)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await restartVM(vm.name);
      onActionComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte starta om VM');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelectionChange?.(vm.name, e.target.checked);
  };

  return (
    <div className={`vm-card ${isSelected ? 'vm-card-selected' : ''}`}>
      <div className="vm-card-header">
        {selectionMode && (
          <label className="vm-checkbox">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleCheckboxChange}
            />
            <span className="vm-checkbox-mark"></span>
          </label>
        )}
        <span className="vm-name">{vm.name}</span>
        <StatusBadge status={vm.powerState} />
      </div>
      <div className="vm-card-body">
        {error && <div className="error-message">{error}</div>}
        <div className="vm-info">
          <div className="vm-info-item">
            <div className="vm-info-label">Storlek</div>
            <div className="vm-info-value">{vm.vmSize}</div>
          </div>
          <div className="vm-info-item">
            <div className="vm-info-label">Plats</div>
            <div className="vm-info-value">{vm.location}</div>
          </div>
          <div className="vm-info-item">
            <div className="vm-info-label">OS</div>
            <div className="vm-info-value">{vm.osType}</div>
          </div>
          <div className="vm-info-item">
            <div className="vm-info-label">Provisioning</div>
            <div className="vm-info-value">{vm.provisioningState}</div>
          </div>
        </div>
        <div className="vm-card-actions">
          <button
            className="btn btn-success"
            onClick={handleStart}
            disabled={loading || isRunning || isTransitioning}
          >
            {loading ? 'Startar...' : '▶ Starta'}
          </button>
          <button
            className="btn btn-danger"
            onClick={handleStop}
            disabled={loading || isStopped || isTransitioning}
          >
            {loading ? 'Stoppar...' : '◼ Stoppa'}
          </button>
          <button
            className="btn btn-warning"
            onClick={handleRestart}
            disabled={loading || isStopped || isTransitioning}
          >
            {loading ? 'Startar om...' : '↻ Starta om'}
          </button>
        </div>
      </div>
    </div>
  );
}
