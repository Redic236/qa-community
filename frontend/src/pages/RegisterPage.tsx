import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, Form, Input, Button, Typography, Alert, Space } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRegisterMutation } from '@/store/apiSlice';
import { useAppDispatch } from '@/store';
import { setCredentials } from '@/store/authSlice';
import { getApiErrorMessage } from '@/utils/errors';
import { usePageTitle } from '@/hooks/usePageTitle';

const schema = z.object({
  username: z
    .string()
    .min(3, 'auth.errors.usernameMin')
    .max(50, 'auth.errors.usernameMax'),
  email: z.string().min(1, 'auth.errors.emailRequired').email('auth.errors.emailInvalid'),
  password: z
    .string()
    .min(6, 'auth.errors.passwordMin')
    .max(100, 'auth.errors.passwordMax'),
});
type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [registerUser, { isLoading, error }] = useRegisterMutation();
  const { t } = useTranslation();
  usePageTitle(t('auth.registerTitle'));

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', email: '', password: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await registerUser(values).unwrap();
      dispatch(setCredentials(result));
      navigate('/', { replace: true });
    } catch {
      /* surfaced via `error` below */
    }
  });

  return (
    <div style={{ maxWidth: 420, margin: '48px auto' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          {t('auth.registerTitle')}
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
            label={t('auth.username')}
            validateStatus={errors.username ? 'error' : ''}
            help={errors.username?.message ? t(errors.username.message) : undefined}
          >
            <Controller
              name="username"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  placeholder={t('auth.usernamePlaceholder')}
                  autoComplete="username"
                />
              )}
            />
          </Form.Item>
          <Form.Item
            label={t('auth.email')}
            validateStatus={errors.email ? 'error' : ''}
            help={errors.email?.message ? t(errors.email.message) : undefined}
          >
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  placeholder={t('auth.emailPlaceholder')}
                  autoComplete="email"
                />
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
                  placeholder={t('auth.passwordPlaceholderMin')}
                  autoComplete="new-password"
                />
              )}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={isLoading}>
            {t('auth.createAccount')}
          </Button>
        </Form>
        <Space style={{ marginTop: 16 }}>
          <Typography.Text type="secondary">{t('auth.haveAccount')}</Typography.Text>
          <Link to="/login">{t('auth.goLogin')}</Link>
        </Space>
      </Card>
    </div>
  );
}
