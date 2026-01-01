import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getVMsSummary, getAuditLog, getCurrentUser, logout, type VMSummary, type AuditLogEntry, type UserInfo } from '../services/api';

export default function Monitoring() {
  const [vmSummaries, setVmSummaries] = useState<VMSummary[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [stats, setStats] = useState({ totalRunning: 0, totalStopped: 0, avgCpu: null as number | null });
  const [auditHours, setAuditHours] = useState(24);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryResult, auditResult] = await Promise.all([
        getVMsSummary(),
        getAuditLog(auditHours, 50)
      ]);

      setVmSummaries(summaryResult.vms);
      setStats({
        totalRunning: summaryResult.totalRunning,
        totalStopped: summaryResult.totalStopped,
        avgCpu: summaryResult.avgCpu
      });
      setAuditLog(auditResult.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta data');
    } finally {
      setLoading(false);
    }
  }, [auditHours]);

  const fetchUser = useCallback(async () => {
    const userInfo = await getCurrentUser();
    setUser(userInfo);
  }, []);

  useEffect(() => {
    fetchUser();
    fetchData();
  }, [fetchUser, fetchData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatTimestamp = (isoString: string): string => {
    try {
      return new Date(isoString).toLocaleString('sv-SE');
    } catch {
      return isoString;
    }
  };

  const getOperationIcon = (operation: string): string => {
    switch (operation) {
      case 'StartVM':
      case 'BatchStartVMs':
        return '▶';
      case 'StopVM':
      case 'BatchStopVMs':
        return '◼';
      case 'RestartVM':
        return '↻';
      case 'UpdateSchedule':
        return '⏰';
      case 'TriggerRunbook':
        return '⚡';
      default:
        return '•';
    }
  };

  return (
    <>
      <header className="header">
        <div>
          <h1>Övervakning</h1>
        </div>
        <div className="header-actions">
          <Link to="/" className="btn btn-outline">
            ← Tillbaka till VMs
          </Link>
          <Link to="/schedules" className="btn btn-outline">
            ⏰ Scheman
          </Link>
          <button className="btn btn-outline refresh-btn" onClick={fetchData} disabled={loading}>
            ↻ Uppdatera
          </button>
          {user && (
            <>
              <span className="user-info">{user.userDetails}</span>
              <button className="btn btn-outline" onClick={logout}>
                Logga ut
              </button>
            </>
          )}
        </div>
      </header>

      <main className="container">
        {error && (
          <div className="error-message">
            {error}
            <button
              className="btn btn-outline"
              onClick={fetchData}
              style={{ marginLeft: '12px' }}
            >
              Försök igen
            </button>
          </div>
        )}

        {loading && vmSummaries.length === 0 ? (
          <div className="loading">
            <div className="spinner" />
            <p>Hämtar övervakningsdata...</p>
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <section className="stats-section">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value running">{stats.totalRunning}</div>
                  <div className="stat-label">VMs igång</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value stopped">{stats.totalStopped}</div>
                  <div className="stat-label">VMs stoppade</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.avgCpu !== null ? `${stats.avgCpu}%` : '-'}</div>
                  <div className="stat-label">Genomsnittlig CPU</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{vmSummaries.length}</div>
                  <div className="stat-label">Totalt VMs</div>
                </div>
              </div>
            </section>

            {/* VM Metrics Summary */}
            <section className="monitoring-section">
              <h2>VM-status</h2>
              <div className="vm-metrics-table">
                <table>
                  <thead>
                    <tr>
                      <th>VM</th>
                      <th>Status</th>
                      <th>CPU %</th>
                      <th>Nätv In (MB)</th>
                      <th>Nätv Ut (MB)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vmSummaries.map(vm => (
                      <tr key={vm.name}>
                        <td className="vm-name-cell">{vm.name}</td>
                        <td>
                          <span className={`status-badge status-${vm.powerState.toLowerCase()}`}>
                            {vm.powerState}
                          </span>
                        </td>
                        <td>
                          {vm.cpuPercent !== null ? (
                            <span className={vm.cpuPercent > 80 ? 'metric-warning' : ''}>
                              {vm.cpuPercent}%
                            </span>
                          ) : '-'}
                        </td>
                        <td>{vm.networkInMB !== null ? vm.networkInMB.toFixed(2) : '-'}</td>
                        <td>{vm.networkOutMB !== null ? vm.networkOutMB.toFixed(2) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Audit Log */}
            <section className="monitoring-section">
              <div className="section-header">
                <h2>Aktivitetslogg</h2>
                <select
                  value={auditHours}
                  onChange={(e) => setAuditHours(parseInt(e.target.value, 10))}
                  className="time-select"
                >
                  <option value={1}>Senaste timmen</option>
                  <option value={6}>Senaste 6 timmarna</option>
                  <option value={24}>Senaste 24 timmarna</option>
                  <option value={72}>Senaste 3 dagarna</option>
                  <option value={168}>Senaste 7 dagarna</option>
                </select>
              </div>

              <div className="audit-log-table">
                <table>
                  <thead>
                    <tr>
                      <th>Tid</th>
                      <th>Operation</th>
                      <th>Status</th>
                      <th>Varaktighet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="empty-row">
                          Inga aktiviteter under denna period
                        </td>
                      </tr>
                    ) : (
                      auditLog.map((entry, idx) => (
                        <tr key={idx}>
                          <td className="timestamp-cell">{formatTimestamp(entry.timestamp)}</td>
                          <td>
                            <span className="operation-badge">
                              {getOperationIcon(entry.operation)} {entry.operation}
                            </span>
                          </td>
                          <td>
                            <span className={`status-indicator ${entry.status.toLowerCase()}`}>
                              {entry.status === 'Success' ? '✓' : '✗'} {entry.status}
                            </span>
                          </td>
                          <td>{entry.duration !== null ? `${Math.round(entry.duration)}ms` : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
