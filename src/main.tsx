import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './hooks/useAuth.tsx';
import App from './App.tsx';
import './index.css';
import { startOfferTimer } from './lib/offerTimer';

// Start the session's free-call countdown on the first page the visitor lands on
startOfferTimer();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
