import { MotionConfig } from 'motion/react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { Boundary } from './Boundary';
import { LibraryProvider } from './library';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Inline styles from motion are out of CSS's reach, so it gets told separately. */}
    <MotionConfig reducedMotion="user">
      <Boundary>
        <LibraryProvider>
          <App />
        </LibraryProvider>
      </Boundary>
    </MotionConfig>
  </React.StrictMode>,
);
