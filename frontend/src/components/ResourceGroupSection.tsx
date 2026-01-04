import { AppServiceInfo } from '../services/api';
import AppServiceCard from './AppServiceCard';

interface ResourceGroupSectionProps {
  resourceGroup: string;
  appServices: AppServiceInfo[];
  isExpanded: boolean;
  onToggle: () => void;
  onStartAppService: (app: AppServiceInfo) => void;
  onStopAppService: (app: AppServiceInfo) => void;
  onRestartAppService: (app: AppServiceInfo) => void;
  updatingAppService: string | null;
}

export default function ResourceGroupSection({
  resourceGroup,
  appServices,
  isExpanded,
  onToggle,
  onStartAppService,
  onStopAppService,
  onRestartAppService,
  updatingAppService
}: ResourceGroupSectionProps) {
  const runningCount = appServices.filter(app => app.state === 'Running').length;
  const stoppedCount = appServices.filter(app => app.state === 'Stopped').length;

  return (
    <div className="resource-group-section" style={{ marginBottom: '24px' }}>
      <div
        className="rg-header"
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px',
          backgroundColor: 'var(--color-gray-100)',
          borderRadius: '8px',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background-color 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-gray-200)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
        }}
      >
        <span style={{ fontSize: '18px' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
          {resourceGroup}
        </h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px', fontSize: '14px' }}>
          <span style={{ color: 'var(--color-gray-600)' }}>
            {appServices.length} app service{appServices.length !== 1 ? 's' : ''}
          </span>
          <span className="status-running" style={{ fontWeight: 500 }}>
            {runningCount} running
          </span>
          <span className="status-stopped" style={{ fontWeight: 500 }}>
            {stoppedCount} stopped
          </span>
        </div>
      </div>

      {isExpanded && (
        <div
          className="rg-content"
          style={{
            marginTop: '12px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
            gap: '16px'
          }}
        >
          {appServices.map(app => (
            <AppServiceCard
              key={app.id}
              appService={app}
              onStart={() => onStartAppService(app)}
              onStop={() => onStopAppService(app)}
              onRestart={() => onRestartAppService(app)}
              disabled={updatingAppService === app.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}
