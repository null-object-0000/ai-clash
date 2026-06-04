import { theme } from 'antd'

export type ThemeMode = 'light' | 'dark'

export function createAntTheme(themeMode: ThemeMode) {
  return {
    algorithm: themeMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#3451b2',
      colorBgBase: themeMode === 'dark' ? '#1b1b1f' : '#ffffff',
      colorBgContainer: themeMode === 'dark' ? '#1b1b1f' : '#ffffff',
      colorBgElevated: themeMode === 'dark' ? '#2f2f35' : '#ffffff',
      colorFillSecondary: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
      colorText: themeMode === 'dark' ? 'rgba(255, 255, 245, 0.92)' : '#213547',
      colorTextSecondary: themeMode === 'dark' ? 'rgba(235, 235, 245, 0.72)' : 'rgba(60, 60, 67, 0.78)',
      colorTextTertiary: themeMode === 'dark' ? 'rgba(235, 235, 245, 0.46)' : 'rgba(60, 60, 67, 0.56)',
      colorBorder: themeMode === 'dark' ? 'rgba(84, 84, 88, 0.65)' : '#e2e2e3',
      colorBorderSecondary: themeMode === 'dark' ? 'rgba(84, 84, 88, 0.48)' : '#e2e2e3',
      borderRadius: 8,
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
  }
}
