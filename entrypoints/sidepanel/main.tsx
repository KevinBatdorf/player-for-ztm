import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { LibraryProvider } from './library';
import { SettingsProvider } from './settings';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsProvider>
      <LibraryProvider>
        <App />
      </LibraryProvider>
    </SettingsProvider>
  </React.StrictMode>,
);
