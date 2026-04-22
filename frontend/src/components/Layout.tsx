import { Suspense } from 'react';
import {
  Layout as AntLayout,
  Menu,
  Button,
  Space,
  Avatar,
  Dropdown,
  Typography,
  Grid,
  Spin,
  theme,
} from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  EditOutlined,
  ProfileOutlined,
  SafetyCertificateOutlined,
  DashboardOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/store';
import { logout } from '@/store/authSlice';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import NotificationsBell from './NotificationsBell';
import LevelBadge from './LevelBadge';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeToggle from './ThemeToggle';
import ScrollToTop from './ScrollToTop';
import ErrorBoundary from './ErrorBoundary';
import { prefetchRoute } from '@/utils/prefetch';

const { Header, Content } = AntLayout;

export default function Layout() {
  const user = useCurrentUser();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { t } = useTranslation();
  const { token: tk } = theme.useToken();

  const activeKey =
    location.pathname === '/'
      ? 'home'
      : location.pathname.startsWith('/leaderboard')
        ? 'leaderboard'
        : '';

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 8 : 24,
          borderBottom: `1px solid ${tk.colorBorderSecondary}`,
          padding: isMobile ? '0 12px' : '0 24px',
        }}
      >
        <Link
          to="/"
          style={{
            fontWeight: 600,
            fontSize: isMobile ? 16 : 18,
            color: '#1677ff',
            whiteSpace: 'nowrap',
          }}
        >
          {t('nav.siteTitle')}
        </Link>
        {!isMobile && (
          <Menu
            mode="horizontal"
            selectedKeys={activeKey ? [activeKey] : []}
            style={{ flex: 1, border: 'none' }}
            items={[
              { key: 'home', label: <Link to="/">{t('nav.home')}</Link> },
              {
                key: 'leaderboard',
                label: (
                  <Link
                    to="/leaderboard"
                    onMouseEnter={() => prefetchRoute('leaderboard')}
                    onFocus={() => prefetchRoute('leaderboard')}
                  >
                    {t('nav.leaderboard')}
                  </Link>
                ),
              },
            ]}
          />
        )}
        {isMobile && <div style={{ flex: 1 }} />}
        <ThemeToggle />
        <LanguageSwitcher />
        {user ? (
          <Space size={isMobile ? 4 : 12}>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => navigate('/questions/new')}
              onMouseEnter={() => prefetchRoute('ask')}
              onFocus={() => prefetchRoute('ask')}
            >
              {!isMobile && t('nav.ask')}
            </Button>
            <NotificationsBell />
            {!isMobile && (
              <Space size={4}>
                <LevelBadge points={user.points} />
                <Typography.Text type="secondary">
                  {t('nav.points', { value: user.points })}
                </Typography.Text>
              </Space>
            )}
            <Dropdown
              trigger={['click', 'hover']}
              onOpenChange={(open) => {
                // Warm every chunk that might be one click away. Cheap and
                // happens before the user has even decided which link to hit.
                if (!open) return;
                prefetchRoute('profile');
                prefetchRoute('achievements');
                if (user.role === 'admin') {
                  prefetchRoute('adminDashboard');
                  prefetchRoute('adminReports');
                }
              }}
              menu={{
                items: [
                  ...(isMobile
                    ? [
                        {
                          key: 'points',
                          icon: <ProfileOutlined />,
                          label: t('nav.points', { value: user.points }),
                          disabled: true,
                        } as const,
                        { type: 'divider' as const },
                      ]
                    : []),
                  {
                    key: 'profile',
                    icon: <ProfileOutlined />,
                    label: t('nav.profile'),
                    onClick: () => navigate('/profile'),
                  },
                  {
                    key: 'achievements',
                    icon: <TrophyOutlined />,
                    label: t('nav.achievements'),
                    onClick: () => navigate('/achievements'),
                  },
                  ...(user.role === 'admin'
                    ? [
                        {
                          key: 'adminDashboard',
                          icon: <DashboardOutlined />,
                          label: t('nav.adminDashboard'),
                          onClick: () => navigate('/admin'),
                        } as const,
                        {
                          key: 'admin',
                          icon: <SafetyCertificateOutlined />,
                          label: t('nav.admin'),
                          onClick: () => navigate('/admin/reports'),
                        } as const,
                      ]
                    : []),
                  { type: 'divider' as const },
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: t('nav.logout'),
                    onClick: () => {
                      dispatch(logout());
                      navigate('/login');
                    },
                  },
                ],
              }}
            >
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  src={user.avatar ?? undefined}
                  icon={<UserOutlined />}
                  size="small"
                />
                {!isMobile && <span>{user.username}</span>}
              </Space>
            </Dropdown>
          </Space>
        ) : (
          <Space size={4}>
            <Button
              onClick={() => navigate('/login')}
              onMouseEnter={() => prefetchRoute('login')}
              onFocus={() => prefetchRoute('login')}
            >
              {t('nav.login')}
            </Button>
            <Button
              type="primary"
              onClick={() => navigate('/register')}
              onMouseEnter={() => prefetchRoute('register')}
              onFocus={() => prefetchRoute('register')}
            >
              {t('nav.register')}
            </Button>
          </Space>
        )}
      </Header>
      <Content
        style={{
          padding: isMobile ? '12px' : '24px',
          maxWidth: 1200,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <ScrollToTop />
        <ErrorBoundary
          title={t('errors.unexpected')}
          resetLabel={t('common.back')}
        >
          <Suspense
            fallback={
              <div style={{ padding: 64, textAlign: 'center' }}>
                <Spin size="large" tip={t('common.loading')} />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </Content>
    </AntLayout>
  );
}
