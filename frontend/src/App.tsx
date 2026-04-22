import { RouterProvider } from 'react-router-dom';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { useTranslation } from 'react-i18next';
import { router } from './routes';
import { ThemeProvider, useThemeMode } from '@/hooks/useThemeMode';

const ANTD_LOCALES = { 'zh-CN': zhCN, 'en-US': enUS } as const;
type SupportedLocale = keyof typeof ANTD_LOCALES;

function ThemedApp(): JSX.Element {
  const { i18n } = useTranslation();
  const { mode } = useThemeMode();
  const lang: SupportedLocale =
    (i18n.language as SupportedLocale) in ANTD_LOCALES
      ? (i18n.language as SupportedLocale)
      : 'zh-CN';

  const isDark = mode === 'dark';

  return (
    <ConfigProvider
      locale={ANTD_LOCALES[lang]}
      button={{ autoInsertSpace: false }}
      theme={{
        // Tokens that differ by mode — primary stays blue, surface/layout flip
        // through the algorithm-derived darkToken set provided by AntD.
        token: {
          colorPrimary: '#1677ff',
          colorBgLayout: isDark ? '#141414' : '#f5f6f8',
          borderRadius: 8,
          fontSize: 14,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        },
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        components: {
          Layout: {
            headerBg: isDark ? '#1f1f1f' : '#ffffff',
            headerHeight: 56,
            headerPadding: '0 24px',
          },
          Card: {
            paddingLG: 20,
          },
          Tabs: {
            horizontalItemPadding: '8px 16px',
          },
        },
      }}
    >
      <AntApp>
        <RouterProvider router={router} />
      </AntApp>
    </ConfigProvider>
  );
}

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}
