import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  listAppServices,
  startAppService,
  stopAppService,
  restartAppService,
  getCurrentUser,
  logout,
  type AppServiceInfo,
  type UserInfo
} from '../services/api';
import ResourceGroupSection from '../components/ResourceGroupSection';

export default function AppServices() {
  const [appServicesByRG, setAppServicesByRG] = useState<Record<string, AppServiceInfo[]>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [updatingAppService, setUpdatingAppService] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [subscriptionsScanned, setSubscriptionsScanned] = useState(0);

  const fetchAppServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listAppServices();
      setAppServicesByRG(response.appServicesByResourceGroup);
      setTotalCount(response.totalCount);
      setSubscriptionsScanned(response.subscriptionsScanned.length);

      // Auto-expand all groups on first load
      if (expandedGroups.size === 0) {
        setExpandedGroups(new Set(Object.keys(response.appServicesByResourceGroup)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta App Services');
    } finally {
      setLoading(false);
    }
  }, [expandedGroups.size]);

  const fetchUser = useCallback(async () => {
    const userInfo = await getCurrentUser();
    setUser(userInfo);
  }, []);

  useEffect(() => {
    fetchUser();
    fetchAppServices();
  }, [fetchUser, fetchAppServices]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchAppServices, 30000);
    return () => clearInterval(interval);
  }, [fetchAppServices]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const handleStartAppService = async (app: AppServiceInfo) => {
    setUpdatingAppService(app.name);
    setMessage(null);
    try {
      const result = await startAppService(app.name, app.subscriptionId, app.resourceGroup);
      setMessage(result.message);
      fetchAppServices();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Kunde inte starta App Service');
    } finally {
      setUpdatingAppService(null);
    }
  };

  const handleStopAppService = async (app: AppServiceInfo) => {
    setUpdatingAppService(app.name);
    setMessage(null);
    try {
      const result = await stopAppService(app.name, app.subscriptionId, app.resourceGroup);
      setMessage(result.message);
      fetchAppServices();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Kunde inte stoppa App Service');
    } finally {
      setUpdatingAppService(null);
    }
  };

  const handleRestartAppService = async (app: AppServiceInfo) => {
    setUpdatingAppService(app.name);
    setMessage(null);
    try {
      const result = await restartAppService(app.name, app.subscriptionId, app.resourceGroup);
      setMessage(result.message);
      fetchAppServices();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Kunde inte starta om App Service');
    } finally {
      setUpdatingAppService(null);
    }
  };

  return (
    <>
      <header className="header">
        <div>
          <h1>App Services</h1>
          <small style={{ color: 'var(--color-gray-600)' }}>
            {totalCount} app services från {subscriptionsScanned} prenumerationer
          </small>
        </div>
        <div className="header-actions">
          <Link to="/" className="btn btn-outline">
            ← Tillbaka till VMs
          </Link>
          <button className="btn btn-outline refresh-btn" onClick={fetchAppServices} disabled={loading}>
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
        {message && (
          <div className="batch-message" style={{ marginBottom: '16px' }}>
            {message}
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
            <button
              className="btn btn-outline"
              onClick={fetchAppServices}
              style={{ marginLeft: '12px' }}
            >
              Försök igen
            </button>
          </div>
        )}

        {loading && Object.keys(appServicesByRG).length === 0 ? (
          <div className="loading">
            <div className="spinner" />
            <p>Hämtar App Services från alla prenumerationer...</p>
          </div>
        ) : (
          <>
            {Object.keys(appServicesByRG).length === 0 ? (
              <div className="empty-state">
                <h2>Inga App Services hittades</h2>
                <p>Det finns inga App Services i dina prenumerationer eller så saknar du behörighet att se dem.</p>
              </div>
            ) : (
              <div>
                {Object.entries(appServicesByRG)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([rgName, apps]) => (
                    <ResourceGroupSection
                      key={rgName}
                      resourceGroup={rgName}
                      appServices={apps}
                      isExpanded={expandedGroups.has(rgName)}
                      onToggle={() => toggleGroup(rgName)}
                      onStartAppService={handleStartAppService}
                      onStopAppService={handleStopAppService}
                      onRestartAppService={handleRestartAppService}
                      updatingAppService={updatingAppService}
                    />
                  ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
