import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal, Form, Input, Alert, Divider, message, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useUpdateProfileMutation } from '@/store/apiSlice';
import { getApiErrorMessage } from '@/utils/errors';
import type { User } from '@/types/models';

const schema = z
  .object({
    username: z
      .string()
      .min(3, 'auth.errors.usernameMin')
      .max(50, 'auth.errors.usernameMax'),
    avatar: z
      .string()
      .max(255)
      .refine((v) => v === '' || /^https?:\/\/.+/i.test(v), {
        message: 'profile.errors.avatarMustBeUrl',
      }),
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .optional()
      .refine((v) => !v || v.length >= 6, { message: 'profile.errors.newPasswordMin' }),
  })
  .refine((data) => !data.newPassword || !!data.currentPassword?.length, {
    message: 'profile.errors.currentPasswordRequired',
    path: ['currentPassword'],
  });
type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  user: User;
  onClose: () => void;
}

export default function EditProfileModal({ open, user, onClose }: Props) {
  const [updateProfile, { isLoading, error }] = useUpdateProfileMutation();
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: user.username,
      avatar: user.avatar ?? '',
      currentPassword: '',
      newPassword: '',
    },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (open) {
      reset({
        username: user.username,
        avatar: user.avatar ?? '',
        currentPassword: '',
        newPassword: '',
      });
    }
  }, [open, user, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const patch: {
      username?: string;
      avatar?: string | null;
      currentPassword?: string;
      newPassword?: string;
    } = {};
    if (values.username !== user.username) patch.username = values.username;
    if (values.avatar !== (user.avatar ?? '')) patch.avatar = values.avatar || null;
    if (values.newPassword) {
      patch.newPassword = values.newPassword;
      patch.currentPassword = values.currentPassword;
    }
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    try {
      await updateProfile(patch).unwrap();
      message.success(t('profile.saved'));
      onClose();
    } catch {
      /* error shown below */
    }
  });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={onSubmit}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={isLoading}
      okButtonProps={{ disabled: !isDirty }}
      title={t('profile.modalTitle')}
      destroyOnClose
    >
      {error && (
        <Alert type="error" message={getApiErrorMessage(error)} style={{ marginBottom: 12 }} />
      )}
      <Form layout="vertical">
        <Form.Item
          label={t('auth.username')}
          validateStatus={errors.username ? 'error' : ''}
          help={errors.username?.message ? t(errors.username.message) : undefined}
        >
          <Controller
            name="username"
            control={control}
            render={({ field }) => <Input {...field} />}
          />
        </Form.Item>
        <Form.Item
          label={t('profile.avatarLabel')}
          validateStatus={errors.avatar ? 'error' : ''}
          help={
            errors.avatar?.message
              ? t(errors.avatar.message)
              : t('profile.avatarHint')
          }
        >
          <Controller
            name="avatar"
            control={control}
            render={({ field }) => (
              <Input {...field} placeholder={t('profile.avatarPlaceholder')} />
            )}
          />
        </Form.Item>

        <Divider plain>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('profile.passwordSection')}
          </Typography.Text>
        </Divider>

        <Form.Item
          label={t('auth.currentPassword')}
          validateStatus={errors.currentPassword ? 'error' : ''}
          help={errors.currentPassword?.message ? t(errors.currentPassword.message) : undefined}
        >
          <Controller
            name="currentPassword"
            control={control}
            render={({ field }) => (
              <Input.Password {...field} autoComplete="current-password" />
            )}
          />
        </Form.Item>
        <Form.Item
          label={t('auth.newPassword')}
          validateStatus={errors.newPassword ? 'error' : ''}
          help={
            errors.newPassword?.message
              ? t(errors.newPassword.message)
              : t('profile.newPasswordHint')
          }
        >
          <Controller
            name="newPassword"
            control={control}
            render={({ field }) => (
              <Input.Password {...field} autoComplete="new-password" />
            )}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
