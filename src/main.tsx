import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { startFeed } from './store';
import './index.css';

// Connect to the live FastAPI/WebSocket feed (mock fallback if unavailable).
startFeed();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
