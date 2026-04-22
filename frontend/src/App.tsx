import { RouterProvider } from 'react-router-dom';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { useTranslation } from 'react-i18next';
import { router } from './routes';

const ANTD_LOCALES = { 'zh-CN': zhCN, 'en-US': enUS } as const;
type SupportedLocale = keyof typeof ANTD_LOCALES;

export default function App() {
  const { i18n } = useTranslation();
  // i18next normalises detected language; fall back to Chinese for anything
  // outside our supported set (custom URL ?lng=foo, etc.).
  const lang: SupportedLocale =
    (i18n.language as SupportedLocale) in ANTD_LOCALES
      ? (i18n.language as SupportedLocale)
      : 'zh-CN';

  return (
    <ConfigProvider
      locale={ANTD_LOCALES[lang]}
      button={{ autoInsertSpace: false }}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          colorBgLayout: '#f5f6f8',
          borderRadius: 8,
          fontSize: 14,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        },
        algorithm: theme.defaultAlgorithm,
        components: {
          Layout: {
            headerBg: '#ffffff',
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
