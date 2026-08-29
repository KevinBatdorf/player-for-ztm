import React from 'react';
import ReactDOM from 'react-dom/client';
import { Watch } from './Watch';
import { Boundary } from '@/components/Boundary';
import '@/assets/style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Boundary>
      <Watch />
    </Boundary>
  </React.StrictMode>,
);
