import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { CoursesProvider } from './courses';
import { SettingsProvider } from './settings';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsProvider>
      <CoursesProvider>
        <App />
      </CoursesProvider>
    </SettingsProvider>
  </React.StrictMode>,
);
