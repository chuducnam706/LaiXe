import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { DailyPlayLimitProvider } from './context/DailyPlayLimitContext';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <DailyPlayLimitProvider>
      <App />
    </DailyPlayLimitProvider>
  </AuthProvider>
);


