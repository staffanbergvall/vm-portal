import { useState, useEffect, useCallback } from 'react';
import { listVMs, getCurrentUser, logout, type VMInfo, type UserInfo } from '../services/api';
import { VMList } from '../components/VMList';

export default function Dashboard() {
  const [vms, setVMs] = useState<VMInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [resourceGroup, setResourceGroup] = useState<string>('');

  const fetchVMs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listVMs();
      setVMs(response.vms);
      setResourceGroup(response.resourceGroup);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta VMs');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUser = useCallback(async () => {
    const userInfo = await getCurrentUser();
    setUser(userInfo);
  }, []);

  useEffect(() => {
    fetchUser();
    fetchVMs();
  }, [fetchUser, fetchVMs]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchVMs, 30000);
    return () => clearInterval(interval);
  }, [fetchVMs]);

  const runningCount = vms.filter(vm => vm.powerState.toLowerCase() === 'running').length;
  const stoppedCount = vms.filter(vm => ['stopped', 'deallocated'].includes(vm.powerState.toLowerCase())).length;

  return (
    <>
      <header className="header">
        <div>
          <h1>VM Portal</h1>
          {resourceGroup && (
            <small style={{ color: 'var(--color-gray-600)' }}>
              {resourceGroup}
            </small>
          )}
        </div>
        <div className="header-actions">
          <span style={{ fontSize: '14px', color: 'var(--color-gray-600)' }}>
            {runningCount} igång · {stoppedCount} stoppade
          </span>
          <button className="btn btn-outline refresh-btn" onClick={fetchVMs} disabled={loading}>
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
              onClick={fetchVMs}
              style={{ marginLeft: '12px' }}
            >
              Försök igen
            </button>
          </div>
        )}

        {loading && vms.length === 0 ? (
          <div className="loading">
            <div className="spinner" />
            <p>Hämtar virtuella maskiner...</p>
          </div>
        ) : (
          <VMList vms={vms} onRefresh={fetchVMs} />
        )}
      </main>
    </>
  );
}
