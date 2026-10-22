import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { DailyPlayLimitProvider } from './context/DailyPlayLimitContext';
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <AuthProvider>
      <DailyPlayLimitProvider>
        <App />
      </DailyPlayLimitProvider>
    </AuthProvider>
  </ErrorBoundary>
);


