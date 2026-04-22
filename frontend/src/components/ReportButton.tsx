import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Modal, Form, Radio, Input, Alert, message, Tooltip } from 'antd';
import { FlagOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSubmitReportMutation } from '@/store/apiSlice';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getApiErrorMessage } from '@/utils/errors';
import type { ReportReason, VoteTargetType } from '@/types/models';

const REASON_VALUES: ReportReason[] = ['spam', 'offensive', 'off_topic', 'duplicate', 'other'];

const schema = z.object({
  reason: z.enum(['spam', 'offensive', 'off_topic', 'duplicate', 'other']),
  details: z.string().max(500, 'report.errors.detailsMax').optional(),
});
type Values = z.infer<typeof schema>;

interface Props {
  targetType: VoteTargetType;
  targetId: number;
  /** Optional: hide the button entirely when current user is the content author. */
  authorId?: number;
  size?: 'small' | 'middle' | 'large';
}

export default function ReportButton({ targetType, targetId, authorId, size = 'small' }: Props) {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [submitReport, { isLoading, error }] = useSubmitReportMutation();

  // Don't show on own content (backend rejects anyway, just cleaner UX).
  if (me && authorId === me.id) return null;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { reason: 'spam', details: '' },
    mode: 'onTouched',
  });

  const openModal = () => {
    if (!me) {
      navigate('/login');
      return;
    }
    reset({ reason: 'spam', details: '' });
    setOpen(true);
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await submitReport({
        targetType,
        targetId,
        reason: values.reason,
        details: values.details || undefined,
      }).unwrap();
      message.success(t('report.submitted'));
      setOpen(false);
    } catch {
      /* shown via `error` */
    }
  });

  return (
    <>
      <Tooltip title={t('report.tooltip')}>
        <Button
          size={size}
          icon={<FlagOutlined />}
          onClick={openModal}
          aria-label={t('report.tooltip')}
        />
      </Tooltip>
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText={t('report.submit')}
        cancelText={t('common.cancel')}
        confirmLoading={isLoading}
        title={t('report.modalTitle')}
        destroyOnClose
      >
        {error && (
          <Alert type="error" message={getApiErrorMessage(error)} style={{ marginBottom: 12 }} />
        )}
        <Form layout="vertical">
          <Form.Item
            label={t('report.reason')}
            validateStatus={errors.reason ? 'error' : ''}
            help={errors.reason?.message}
          >
            <Controller
              name="reason"
              control={control}
              render={({ field }) => (
                <Radio.Group {...field}>
                  {REASON_VALUES.map((r) => (
                    <Radio key={r} value={r} style={{ display: 'block', padding: '6px 0' }}>
                      <strong>{t(`report.reasons.${r}`)}</strong>
                      <span style={{ color: '#8c8c8c', marginLeft: 8, fontSize: 12 }}>
                        {t(`report.reasons.${r}Hint`)}
                      </span>
                    </Radio>
                  ))}
                </Radio.Group>
              )}
            />
          </Form.Item>
          <Form.Item
            label={t('report.detailsLabel')}
            validateStatus={errors.details ? 'error' : ''}
            help={errors.details?.message ? t(errors.details.message) : undefined}
          >
            <Controller
              name="details"
              control={control}
              render={({ field }) => (
                <Input.TextArea
                  {...field}
                  rows={3}
                  placeholder={t('report.detailsPlaceholder')}
                />
              )}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
