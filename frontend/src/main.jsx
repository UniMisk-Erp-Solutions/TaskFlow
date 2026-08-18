import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import MaintenanceGate from './MaintenanceGate';

// Log the build timestamp on every boot so you can verify the exact deployed
// version from the browser console (handy when CDN / Coolify caching is suspect).
// Open DevTools → Console → look for the "TaskFlow build" line.
const BUILD_STAMP = typeof __TASKFLOW_BUILD__ === 'string' ? __TASKFLOW_BUILD__ : 'dev';
window.__TASKFLOW_BUILD__ = BUILD_STAMP;
// eslint-disable-next-line no-console
console.log(
  `%cTaskFlow build %c${BUILD_STAMP}`,
  'color:#8B5CF6;font-weight:600;',
  'color:#1a1a1a;font-family:monospace;background:#f6f5f4;padding:2px 6px;border-radius:4px;',
);

// Handle 404 errors by redirecting to index.html
if (window.location.pathname !== '/' && !window.location.pathname.includes('.')) {
  console.log('SPA: Handling route:', window.location.pathname);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Outermost wrapper: when the cloud maintenance system flags "taskflow",
        the app tree below (router, auth/session, theme, Supabase client usage)
        never mounts. Fail-open — any error renders <App /> normally. */}
    <MaintenanceGate projectKey="taskflow">
      <App />
    </MaintenanceGate>
  </React.StrictMode>
);
