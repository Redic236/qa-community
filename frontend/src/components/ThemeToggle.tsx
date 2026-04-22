import { Button, Tooltip } from 'antd';
import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '@/hooks/useThemeMode';

export default function ThemeToggle(): JSX.Element {
  const { mode, toggle } = useThemeMode();
  const { t } = useTranslation();
  const isDark = mode === 'dark';

  return (
    <Tooltip title={isDark ? t('theme.toLight') : t('theme.toDark')}>
      <Button
        type="text"
        shape="circle"
        icon={isDark ? <SunOutlined /> : <MoonOutlined />}
        onClick={toggle}
        aria-label={isDark ? t('theme.toLight') : t('theme.toDark')}
      />
    </Tooltip>
  );
}
