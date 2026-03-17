import { createRoot } from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import { App as AntdApp } from 'antd';
import { XProvider } from '@ant-design/x';
import App from './App';
import './style.css';

createRoot(document.getElementById('app')!).render(
  <ConfigProvider
    theme={{
      token: {
        colorPrimary: '#6366f1',
        borderRadius: 8,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
        fontSize: 13,
      },
      algorithm: theme.defaultAlgorithm,
      components: {
        Button: {
          borderRadius: 8,
        },
        Input: {
          borderRadius: 8,
        },
        Select: {
          borderRadius: 8,
        },
        Collapse: {
          borderRadius: 12,
        },
        Modal: {
          borderRadius: 12,
        },
        Drawer: {
          borderRadius: 12,
        },
      },
    }}
  >
    <AntdApp>
      <XProvider>
        <App />
      </XProvider>
    </AntdApp>
  </ConfigProvider>
);
