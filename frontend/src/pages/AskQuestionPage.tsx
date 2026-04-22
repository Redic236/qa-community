import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, Form, Input, Button, Typography, Alert, Tag, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCreateQuestionMutation } from '@/store/apiSlice';
import { getApiErrorMessage } from '@/utils/errors';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import MarkdownEditor from '@/components/MarkdownEditor';
import { uploadImage } from '@/utils/upload';

const schema = z.object({
  title: z
    .string()
    .min(5, 'question.errors.titleMin')
    .max(200, 'question.errors.titleMax'),
  content: z.string().min(10, 'question.errors.contentMin'),
  tags: z.array(z.string().min(1).max(50)).max(5, 'question.errors.tagsMax').optional(),
});
type Values = z.infer<typeof schema>;

export default function AskQuestionPage() {
  const navigate = useNavigate();
  const [tagInput, setTagInput] = useState('');
  const [createQuestion, { isLoading, error }] = useCreateQuestionMutation();
  const { t } = useTranslation();
  usePageTitle(t('question.publishTitle'));

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitSuccessful },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', content: '', tags: [] },
    mode: 'onTouched',
  });

  const tags = watch('tags') ?? [];

  // Guard draft content against accidental tab close / reload. React-router
  // in-app navigation isn't affected, so the post-submit navigate() is fine.
  useUnsavedChangesWarning(isDirty && !isSubmitSuccessful);

  const addTag = () => {
    const v = tagInput.trim().toLowerCase();
    if (!v) return;
    if (v.length > 50) return;
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
      const created = await createQuestion(values).unwrap();
      navigate(`/questions/${created.id}`, { replace: true });
    } catch {
      /* error shown below */
    }
  });

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          {t('question.publishTitle')}
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          {t('question.publishHint')}
        </Typography.Paragraph>
        {error && (
          <Alert
            type="error"
            message={getApiErrorMessage(error)}
            style={{ marginBottom: 16 }}
          />
        )}
        <Form layout="vertical" onFinish={onSubmit}>
          <Form.Item
            label={t('question.title')}
            validateStatus={errors.title ? 'error' : ''}
            help={errors.title?.message ? t(errors.title.message) : t('question.titleHint')}
          >
            <Controller
              name="title"
              control={control}
              render={({ field }) => (
                <Input {...field} placeholder={t('question.titlePlaceholder')} />
              )}
            />
          </Form.Item>
          <Form.Item
            label={t('question.content')}
            validateStatus={errors.content ? 'error' : ''}
            help={errors.content?.message ? t(errors.content.message) : t('question.contentHint')}
          >
            <Controller
              name="content"
              control={control}
              render={({ field }) => (
                <MarkdownEditor
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  rows={10}
                  placeholder={t('question.contentPlaceholder')}
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
            <Controller
              name="tags"
              control={control}
              render={() => (
                <>
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
                </>
              )}
            />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={isLoading}>
              {t('common.publish')}
            </Button>
            <Button onClick={() => navigate(-1)}>{t('common.cancel')}</Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
