import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Handle 404 errors by redirecting to index.html
if (window.location.pathname !== '/' && !window.location.pathname.includes('.')) {
  console.log('SPA: Handling route:', window.location.pathname);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
