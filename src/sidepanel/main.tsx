import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import App from './App';
import './style.css';

createRoot(document.getElementById('app')!).render(
  <ConfigProvider>
    <AntdApp>
      <App />
    </AntdApp>
  </ConfigProvider>
);
