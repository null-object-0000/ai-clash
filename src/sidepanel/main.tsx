import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@lobehub/ui';
import App from './App';
import './style.css';

createRoot(document.getElementById('app')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
