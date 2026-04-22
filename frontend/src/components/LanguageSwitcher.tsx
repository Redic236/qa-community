import { Dropdown, Button, type MenuProps } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n';

const LABEL: Record<Locale, string> = {
  'zh-CN': '中文',
  'en-US': 'English',
};

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const items: MenuProps['items'] = SUPPORTED_LOCALES.map((code) => ({
    key: code,
    label: LABEL[code],
    onClick: () => {
      void i18n.changeLanguage(code);
    },
  }));

  const current = SUPPORTED_LOCALES.includes(i18n.language as Locale)
    ? (i18n.language as Locale)
    : 'zh-CN';

  return (
    <Dropdown
      menu={{ items, selectedKeys: [current] }}
      trigger={['click', 'hover']}
    >
      <Button
        type="text"
        icon={<GlobalOutlined />}
        size="small"
        aria-label={t('language.switch')}
      >
        {LABEL[current]}
      </Button>
    </Dropdown>
  );
}
