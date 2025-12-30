import { useState } from 'react';
import type { VMInfo } from '../services/api';
import { startVM, stopVM } from '../services/api';
import { StatusBadge } from './StatusBadge';

interface VMCardProps {
  vm: VMInfo;
  onActionComplete: () => void;
}

export function VMCard({ vm, onActionComplete }: VMCardProps) {
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

  return (
    <div className="vm-card">
      <div className="vm-card-header">
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
        </div>
      </div>
    </div>
  );
}
