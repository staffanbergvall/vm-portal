import { useState, useEffect, useCallback } from 'react';
import { listVMs, getCurrentUser, logout, batchStartVMs, batchStopVMs, type VMInfo, type UserInfo } from '../services/api';
import { VMList } from '../components/VMList';

export default function Dashboard() {
  const [vms, setVMs] = useState<VMInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [resourceGroup, setResourceGroup] = useState<string>('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedVMs, setSelectedVMs] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);

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

  const handleSelectionChange = useCallback((vmName: string, selected: boolean) => {
    setSelectedVMs(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(vmName);
      } else {
        next.delete(vmName);
      }
      return next;
    });
  }, []);

  const toggleSelectionMode = () => {
    setSelectionMode(prev => !prev);
    if (selectionMode) {
      setSelectedVMs(new Set());
    }
  };

  const selectAll = () => {
    setSelectedVMs(new Set(vms.map(vm => vm.name)));
  };

  const clearSelection = () => {
    setSelectedVMs(new Set());
  };

  const handleBatchStart = async () => {
    if (selectedVMs.size === 0) return;

    setBatchLoading(true);
    setBatchMessage(null);
    try {
      const result = await batchStartVMs(Array.from(selectedVMs));
      setBatchMessage(result.message);
      setSelectedVMs(new Set());
      fetchVMs();
    } catch (err) {
      setBatchMessage(err instanceof Error ? err.message : 'Batch-start misslyckades');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchStop = async () => {
    if (selectedVMs.size === 0) return;

    if (!confirm(`Är du säker på att du vill stoppa ${selectedVMs.size} VMs?`)) {
      return;
    }

    setBatchLoading(true);
    setBatchMessage(null);
    try {
      const result = await batchStopVMs(Array.from(selectedVMs));
      setBatchMessage(result.message);
      setSelectedVMs(new Set());
      fetchVMs();
    } catch (err) {
      setBatchMessage(err instanceof Error ? err.message : 'Batch-stopp misslyckades');
    } finally {
      setBatchLoading(false);
    }
  };

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
          <button
            className={`btn ${selectionMode ? 'btn-primary' : 'btn-outline'}`}
            onClick={toggleSelectionMode}
          >
            ☑ Batch
          </button>
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

      {selectionMode && (
        <div className="batch-toolbar">
          <div className="batch-toolbar-info">
            <span>{selectedVMs.size} VM(s) valda</span>
            <button className="btn btn-link" onClick={selectAll}>Välj alla</button>
            <button className="btn btn-link" onClick={clearSelection}>Rensa</button>
          </div>
          <div className="batch-toolbar-actions">
            <button
              className="btn btn-success"
              onClick={handleBatchStart}
              disabled={batchLoading || selectedVMs.size === 0}
            >
              {batchLoading ? 'Startar...' : `▶ Starta ${selectedVMs.size > 0 ? `(${selectedVMs.size})` : ''}`}
            </button>
            <button
              className="btn btn-danger"
              onClick={handleBatchStop}
              disabled={batchLoading || selectedVMs.size === 0}
            >
              {batchLoading ? 'Stoppar...' : `◼ Stoppa ${selectedVMs.size > 0 ? `(${selectedVMs.size})` : ''}`}
            </button>
          </div>
          {batchMessage && (
            <div className="batch-message">{batchMessage}</div>
          )}
        </div>
      )}

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
          <VMList
            vms={vms}
            onRefresh={fetchVMs}
            selectedVMs={selectedVMs}
            onSelectionChange={handleSelectionChange}
            selectionMode={selectionMode}
          />
        )}
      </main>
    </>
  );
}
