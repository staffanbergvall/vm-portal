import { AppServiceInfo } from '../services/api';
import { StatusBadge } from './StatusBadge';

interface AppServiceCardProps {
  appService: AppServiceInfo;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  disabled?: boolean;
}

export default function AppServiceCard({
  appService,
  onStart,
  onStop,
  onRestart,
  disabled = false
}: AppServiceCardProps) {
  const isRunning = appService.state === 'Running';
  const isStopped = appService.state === 'Stopped';
  const stateClass = isRunning ? 'running' : 'stopped';

  return (
    <div className={`vm-card ${stateClass}`}>
      <div className="vm-header">
        <h3>{appService.name}</h3>
        <StatusBadge status={appService.state} />
      </div>

      <div className="vm-details">
        <div className="detail-row">
          <span className="detail-label">Subscription:</span>
          <span className="detail-value">{appService.subscriptionName}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Resource Group:</span>
          <span className="detail-value">{appService.resourceGroup}</span>
        </div>
        {appService.sku && (
          <div className="detail-row">
            <span className="detail-label">SKU:</span>
            <span className="detail-value">{appService.sku}</span>
          </div>
        )}
        {appService.kind && (
          <div className="detail-row">
            <span className="detail-label">Type:</span>
            <span className="detail-value">{appService.kind}</span>
          </div>
        )}
        <div className="detail-row">
          <span className="detail-label">Location:</span>
          <span className="detail-value">{appService.location}</span>
        </div>
      </div>

      <div className="vm-actions">
        <button
          className="btn btn-success"
          onClick={onStart}
          disabled={disabled || isRunning}
          title={isRunning ? 'Already running' : 'Start App Service'}
        >
          ▶ Start
        </button>
        <button
          className="btn btn-danger"
          onClick={onStop}
          disabled={disabled || isStopped}
          title={isStopped ? 'Already stopped' : 'Stop App Service'}
        >
          ◼ Stop
        </button>
        <button
          className="btn btn-warning"
          onClick={onRestart}
          disabled={disabled || isStopped}
          title={isStopped ? 'Cannot restart stopped service' : 'Restart App Service'}
        >
          ↻ Restart
        </button>
      </div>
    </div>
  );
}
