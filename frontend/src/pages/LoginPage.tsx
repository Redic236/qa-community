import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, Form, Input, Button, Typography, Alert, Space } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLoginMutation } from '@/store/apiSlice';
import { useAppDispatch } from '@/store';
import { setCredentials } from '@/store/authSlice';
import { getApiErrorMessage } from '@/utils/errors';
import { usePageTitle } from '@/hooks/usePageTitle';

// Zod is built once at import-time, so its messages can't read the live i18n
// language. We tag them as i18n keys here and translate inside the component.
const schema = z.object({
  email: z.string().min(1, 'auth.errors.emailRequired').email('auth.errors.emailInvalid'),
  password: z.string().min(6, 'auth.errors.passwordMin'),
});
type Values = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const [login, { isLoading, error }] = useLoginMutation();
  const { t } = useTranslation();
  usePageTitle(t('auth.loginTitle'));

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await login(values).unwrap();
      dispatch(setCredentials(result));
      navigate(from, { replace: true });
    } catch {
      /* surfaced via `error` below */
    }
  });

  return (
    <div style={{ maxWidth: 420, margin: '48px auto' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          {t('auth.loginTitle')}
        </Typography.Title>
        {error && (
          <Alert
            type="error"
            message={getApiErrorMessage(error)}
            style={{ marginBottom: 16 }}
          />
        )}
        <Form layout="vertical" onFinish={onSubmit}>
          <Form.Item
            label={t('auth.email')}
            validateStatus={errors.email ? 'error' : ''}
            help={errors.email?.message ? t(errors.email.message) : undefined}
          >
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <Input {...field} placeholder={t('auth.emailPlaceholder')} autoComplete="email" />
              )}
            />
          </Form.Item>
          <Form.Item
            label={t('auth.password')}
            validateStatus={errors.password ? 'error' : ''}
            help={errors.password?.message ? t(errors.password.message) : undefined}
          >
            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <Input.Password
                  {...field}
                  placeholder={t('auth.passwordPlaceholderMask')}
                  autoComplete="current-password"
                />
              )}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={isLoading}>
            {t('auth.loginTitle')}
          </Button>
        </Form>
        <Space style={{ marginTop: 16 }}>
          <Typography.Text type="secondary">{t('auth.noAccount')}</Typography.Text>
          <Link to="/register">{t('auth.goRegister')}</Link>
        </Space>
      </Card>
    </div>
  );
}
