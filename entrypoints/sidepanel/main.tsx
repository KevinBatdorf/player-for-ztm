import { MotionConfig } from 'motion/react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { LibraryProvider } from './library';
import { SettingsProvider } from './settings';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Inline styles from motion are out of CSS's reach, so it gets told separately. */}
    <MotionConfig reducedMotion="user">
      <SettingsProvider>
        <LibraryProvider>
          <App />
        </LibraryProvider>
      </SettingsProvider>
    </MotionConfig>
  </React.StrictMode>,
);
