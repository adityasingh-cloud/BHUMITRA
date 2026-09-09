import { useEffect, useState } from 'react';
import { db, type DBProject } from './db/database';
import { runSync, startSyncMonitor, stopSyncMonitor } from './sync/syncEngine';
import { updateNetworkStatus, useNetworkStore } from './store/networkStore';

function SyncBadge(): JSX.Element {
  const isOnline = useNetworkStore((state) => state.isOnline);
  const pending = useNetworkStore((state) => state.pending + state.photos_pending);

  return (
    <span className={isOnline ? 'badge-online' : 'badge-offline'}>
      {isOnline ? 'Online' : `Offline - ${pending} pending`}
    </span>
  );
}

export default function App(): JSX.Element {
  const [projects, setProjects] = useState<DBProject[]>([]);
  const [databaseReady, setDatabaseReady] = useState(false);
  const isOnline = useNetworkStore((state) => state.isOnline);
  const refreshStats = useNetworkStore((state) => state.refreshStats);

  useEffect(() => {
    let active = true;

    const loadLocalProjects = async (): Promise<void> => {
      const localProjects = await db.projects.orderBy('cached_at').reverse().toArray();
      if (active) {
        setProjects(localProjects);
        setDatabaseReady(true);
      }
    };

    void loadLocalProjects();
    void refreshStats();
    startSyncMonitor();

    const handleOnline = (): void => updateNetworkStatus(true);
    const handleOffline = (): void => updateNetworkStatus(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) {
      void runSync().then(refreshStats);
    }

    return () => {
      active = false;
      stopSyncMonitor();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshStats]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Bhumitra Field Operations</p>
          <h1>Assigned projects</h1>
        </div>
        <SyncBadge />
      </header>

      <section className="status-panel" aria-live="polite">
        <strong>{isOnline ? 'Connected' : 'Working offline'}</strong>
        <span>{databaseReady ? 'Local project data is ready on this device.' : 'Opening local database...'}</span>
      </section>

      <section aria-labelledby="projects-heading">
        <div className="section-heading">
          <h2 id="projects-heading">Projects</h2>
          <span>{projects.length} cached</span>
        </div>
        {projects.length === 0 ? (
          <div className="empty-state">
            <h3>No projects cached yet</h3>
            <p>Projects downloaded from the backend will remain available here without a connection.</p>
          </div>
        ) : (
          <ul className="project-list">
            {projects.map((project) => (
              <li className="project-card" key={project.id}>
                <strong>{project.name}</strong>
                <span>{project.current_stage} · {project.status}</span>
                <small>Last cached {new Date(project.cached_at).toLocaleString()}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}