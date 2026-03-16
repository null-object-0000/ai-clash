import { createRoot } from 'react-dom/client';
import { ConfigProvider, ThemeProvider, ToastHost } from '@lobehub/ui';
import { motion } from 'motion/react';
import App from './App';
import './style.css';

createRoot(document.getElementById('app')!).render(
  <ThemeProvider
    customTheme={{ primaryColor: 'geekblue', neutralColor: 'slate' }}
  >
    <ConfigProvider motion={motion}>
      <App />
      <ToastHost />
    </ConfigProvider>
  </ThemeProvider>
);
