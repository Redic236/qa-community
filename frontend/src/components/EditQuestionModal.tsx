import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal, Form, Input, Tag, Space, Alert, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useUpdateQuestionMutation } from '@/store/apiSlice';
import { getApiErrorMessage } from '@/utils/errors';
import MarkdownEditor from '@/components/MarkdownEditor';
import { uploadImage } from '@/utils/upload';
import type { Question } from '@/types/models';

const schema = z.object({
  title: z
    .string()
    .min(5, 'question.errors.titleMin')
    .max(200, 'question.errors.titleMax'),
  content: z.string().min(10, 'question.errors.contentMin'),
  tags: z.array(z.string().min(1).max(50)).max(5, 'question.errors.tagsMax'),
});
type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  question: Question;
  onClose: () => void;
}

export default function EditQuestionModal({ open, question, onClose }: Props) {
  const [tagInput, setTagInput] = useState('');
  const [updateQuestion, { isLoading, error }] = useUpdateQuestionMutation();
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: question.title, content: question.content, tags: question.tags },
    mode: 'onTouched',
  });

  // Sync defaults when reopened on a different question.
  useEffect(() => {
    if (open) {
      reset({ title: question.title, content: question.content, tags: question.tags });
      setTagInput('');
    }
  }, [open, question, reset]);

  const tags = watch('tags');

  const addTag = () => {
    const v = tagInput.trim().toLowerCase();
    if (!v || v.length > 50) return;
    if (tags.includes(v)) {
      setTagInput('');
      return;
    }
    if (tags.length >= 5) return;
    setValue('tags', [...tags, v], { shouldValidate: true });
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setValue('tags', tags.filter((x) => x !== tag), { shouldValidate: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateQuestion({ id: question.id, ...values }).unwrap();
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
      title={t('question.editTitle')}
      width={680}
      destroyOnClose
    >
      {error && (
        <Alert type="error" message={getApiErrorMessage(error)} style={{ marginBottom: 12 }} />
      )}
      <Form layout="vertical">
        <Form.Item
          label={t('question.title')}
          validateStatus={errors.title ? 'error' : ''}
          help={errors.title?.message ? t(errors.title.message) : undefined}
        >
          <Controller
            name="title"
            control={control}
            render={({ field }) => <Input {...field} />}
          />
        </Form.Item>
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
        <Form.Item
          label={t('question.tags')}
          validateStatus={errors.tags ? 'error' : ''}
          help={errors.tags?.message ? t(errors.tags.message) : t('question.tagsHintMax')}
        >
          <Space wrap style={{ marginBottom: 8 }}>
            {tags.map((tg) => (
              <Tag key={tg} closable color="blue" onClose={() => removeTag(tg)}>
                {tg}
              </Tag>
            ))}
          </Space>
          <Input
            placeholder={
              tags.length >= 5
                ? t('question.tagInputDisabled')
                : t('question.tagInputPlaceholder')
            }
            value={tagInput}
            disabled={tags.length >= 5}
            onChange={(e) => setTagInput(e.target.value)}
            onPressEnter={(e) => {
              e.preventDefault();
              addTag();
            }}
            onBlur={addTag}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
