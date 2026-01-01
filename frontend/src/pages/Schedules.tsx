import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { listSchedules, updateSchedule, triggerRunbook, getCurrentUser, logout, type ScheduleInfo, type UserInfo } from '../services/api';

export default function Schedules() {
  const [schedules, setSchedules] = useState<ScheduleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [automationAccount, setAutomationAccount] = useState<string>('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listSchedules();
      setSchedules(response.schedules);
      setAutomationAccount(response.automationAccount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta scheman');
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
    fetchSchedules();
  }, [fetchUser, fetchSchedules]);

  const handleToggleSchedule = async (schedule: ScheduleInfo) => {
    setUpdating(schedule.name);
    setMessage(null);
    try {
      const result = await updateSchedule(schedule.name, !schedule.isEnabled);
      setMessage(result.message);
      fetchSchedules();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Kunde inte uppdatera schema');
    } finally {
      setUpdating(null);
    }
  };

  const handleTriggerRunbook = async (runbookName: string) => {
    setTriggering(runbookName);
    setMessage(null);
    try {
      const result = await triggerRunbook(runbookName);
      setMessage(`${result.message} (Job ID: ${result.jobId})`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Kunde inte köra runbook');
    } finally {
      setTriggering(null);
    }
  };

  const formatDateTime = (isoString: string | null): string => {
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleString('sv-SE');
    } catch {
      return isoString;
    }
  };

  const formatWeekDays = (days: string[] | null): string => {
    if (!days || days.length === 0) return '-';
    const dayMap: { [key: string]: string } = {
      Monday: 'Mån',
      Tuesday: 'Tis',
      Wednesday: 'Ons',
      Thursday: 'Tor',
      Friday: 'Fre',
      Saturday: 'Lör',
      Sunday: 'Sön'
    };
    return days.map(d => dayMap[d] || d).join(', ');
  };

  return (
    <>
      <header className="header">
        <div>
          <h1>Schemaläggning</h1>
          {automationAccount && (
            <small style={{ color: 'var(--color-gray-600)' }}>
              {automationAccount}
            </small>
          )}
        </div>
        <div className="header-actions">
          <Link to="/" className="btn btn-outline">
            ← Tillbaka till VMs
          </Link>
          <button className="btn btn-outline refresh-btn" onClick={fetchSchedules} disabled={loading}>
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
              onClick={fetchSchedules}
              style={{ marginLeft: '12px' }}
            >
              Försök igen
            </button>
          </div>
        )}

        {loading && schedules.length === 0 ? (
          <div className="loading">
            <div className="spinner" />
            <p>Hämtar scheman...</p>
          </div>
        ) : (
          <>
            <section className="schedule-section">
              <h2>Automatiska scheman</h2>
              <p className="section-description">
                Scheman som automatiskt startar och stoppar VMs på specifika tider.
              </p>

              <div className="schedule-list">
                {schedules.map(schedule => (
                  <div key={schedule.name} className={`schedule-card ${schedule.isEnabled ? 'enabled' : 'disabled'}`}>
                    <div className="schedule-header">
                      <h3>{schedule.name}</h3>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={schedule.isEnabled}
                          onChange={() => handleToggleSchedule(schedule)}
                          disabled={updating === schedule.name}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </div>

                    {schedule.description && (
                      <p className="schedule-description">{schedule.description}</p>
                    )}

                    <div className="schedule-details">
                      <div className="detail-row">
                        <span className="detail-label">Status:</span>
                        <span className={`status-badge ${schedule.isEnabled ? 'status-running' : 'status-stopped'}`}>
                          {schedule.isEnabled ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Frekvens:</span>
                        <span>{schedule.frequency}</span>
                      </div>
                      {schedule.weekDays && (
                        <div className="detail-row">
                          <span className="detail-label">Dagar:</span>
                          <span>{formatWeekDays(schedule.weekDays)}</span>
                        </div>
                      )}
                      <div className="detail-row">
                        <span className="detail-label">Nästa körning:</span>
                        <span>{formatDateTime(schedule.nextRun)}</span>
                      </div>
                      {schedule.timeZone && (
                        <div className="detail-row">
                          <span className="detail-label">Tidszon:</span>
                          <span>{schedule.timeZone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="schedule-section">
              <h2>Manuell körning</h2>
              <p className="section-description">
                Kör schemalagda runbooks direkt utan att vänta på nästa schemalagda tid.
              </p>

              <div className="runbook-actions">
                <button
                  className="btn btn-success"
                  onClick={() => handleTriggerRunbook('Start-ScheduledVMs')}
                  disabled={triggering !== null}
                >
                  {triggering === 'Start-ScheduledVMs' ? 'Startar...' : '▶ Starta alla schemalagda VMs'}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleTriggerRunbook('Stop-ScheduledVMs')}
                  disabled={triggering !== null}
                >
                  {triggering === 'Stop-ScheduledVMs' ? 'Stoppar...' : '◼ Stoppa alla schemalagda VMs'}
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
