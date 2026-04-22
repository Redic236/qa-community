import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal, Form, Alert, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useUpdateAnswerMutation } from '@/store/apiSlice';
import { getApiErrorMessage } from '@/utils/errors';
import MarkdownEditor from '@/components/MarkdownEditor';
import { uploadImage } from '@/utils/upload';
import type { Answer } from '@/types/models';

const schema = z.object({
  content: z.string().min(5, 'answer.errors.contentMin'),
});
type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  answer: Answer;
  questionId: number;
  onClose: () => void;
}

export default function EditAnswerModal({ open, answer, questionId, onClose }: Props) {
  const [updateAnswer, { isLoading, error }] = useUpdateAnswerMutation();
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { content: answer.content },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (open) reset({ content: answer.content });
  }, [open, answer, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateAnswer({ answerId: answer.id, questionId, content: values.content }).unwrap();
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
      title={t('answer.editTitle')}
      width={680}
      destroyOnClose
    >
      {error && (
        <Alert type="error" message={getApiErrorMessage(error)} style={{ marginBottom: 12 }} />
      )}
      <Form layout="vertical">
        <Form.Item
          label={t('question.content')}
          validateStatus={errors.content ? 'error' : ''}
          help={errors.content?.message ? t(errors.content.message) : undefined}
        >
          <Controller
            name="content"
            control={control}
            render={({ field }) => (
              <MarkdownEditor
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                rows={8}
                onUploadImage={uploadImage}
              />
            )}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
