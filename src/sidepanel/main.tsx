import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import { App as AntdApp } from 'antd';
import { XProvider } from '@ant-design/x';
import App from './App';
import './style.css';

createRoot(document.getElementById('app')!).render(
  <ConfigProvider>
    <AntdApp>
      <XProvider>
        <App />
      </XProvider>
    </AntdApp>
  </ConfigProvider>
);
