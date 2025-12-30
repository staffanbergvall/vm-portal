interface StatusBadgeProps {
  status: string;
}

const statusLabels: Record<string, string> = {
  running: 'Igång',
  stopped: 'Stoppad',
  deallocated: 'Frigiven',
  starting: 'Startar...',
  stopping: 'Stoppar...',
  deallocating: 'Frigör...',
  unknown: 'Okänd'
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  const label = statusLabels[normalizedStatus] || status;

  const getStatusClass = () => {
    switch (normalizedStatus) {
      case 'running':
        return 'status-running';
      case 'stopped':
      case 'deallocated':
        return 'status-deallocated';
      case 'starting':
      case 'stopping':
      case 'deallocating':
        return 'status-starting';
      default:
        return 'status-unknown';
    }
  };

  const getStatusIcon = () => {
    switch (normalizedStatus) {
      case 'running':
        return '●';
      case 'stopped':
      case 'deallocated':
        return '○';
      case 'starting':
      case 'stopping':
      case 'deallocating':
        return '◐';
      default:
        return '?';
    }
  };

  return (
    <span className={`status-badge ${getStatusClass()}`}>
      <span>{getStatusIcon()}</span>
      <span>{label}</span>
    </span>
  );
}
