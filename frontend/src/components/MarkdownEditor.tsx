import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent } from 'react';
import { Tabs, Input, Typography, Space, Upload, message } from 'antd';
import { PictureOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { useTranslation } from 'react-i18next';
import MarkdownRenderer from './MarkdownRenderer';

export interface MarkdownEditorHandle {
  focus: () => void;
}

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  /**
   * Optional image upload handler. If provided, the editor accepts paste,
   * drop, and "insert image" button for inline images. Should resolve to a
   * public URL; the editor inserts `![name](url)` at the cursor.
   */
  onUploadImage?: (file: File) => Promise<string>;
}

/**
 * Markdown input with Write / Preview tabs. Keeps the form-facing API
 * compatible with `<Input.TextArea>` (value/onChange/onBlur) so
 * react-hook-form Controller wrappers don't need special handling.
 *
 * Paste/drop/upload image support lights up when `onUploadImage` is wired —
 * otherwise it behaves like a plain markdown-aware textarea.
 */
const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(function MarkdownEditor(
  { value = '', onChange, onBlur, placeholder, rows = 8, maxLength, onUploadImage },
  ref
) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<TextAreaRef>(null);
  const [uploading, setUploading] = useState(false);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  const insertAtCursor = (text: string): void => {
    const el = textareaRef.current?.resizableTextArea?.textArea;
    if (!el) {
      onChange?.((value ?? '') + text);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange?.(next);
    // Restore cursor after React re-render.
    queueMicrotask(() => {
      el.focus();
      const caret = start + text.length;
      el.setSelectionRange(caret, caret);
    });
  };

  const handleUpload = async (file: File): Promise<void> => {
    if (!onUploadImage) return;
    setUploading(true);
    // Insert a placeholder immediately so the user sees something happen;
    // replace with the real URL once upload resolves.
    const placeholderMd = `![${t('markdown.uploading')}](...)`;
    insertAtCursor(placeholderMd);
    try {
      const url = await onUploadImage(file);
      const finalMd = `![${file.name.replace(/\.[^.]+$/, '')}](${url})`;
      // Replace just the first occurrence of the placeholder we inserted.
      // Using a functional update would be cleaner but Controller doesn't
      // thread the new value back to us; re-reading via the current prop.
      onChange?.((value ?? '').replace(placeholderMd, finalMd) || finalMd);
    } catch (err) {
      message.error((err as Error).message || t('markdown.uploadFailed'));
      onChange?.((value ?? '').replace(placeholderMd, ''));
    } finally {
      setUploading(false);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>): void => {
    if (!onUploadImage) return;
    const item = Array.from(e.clipboardData?.items ?? []).find(
      (it) => it.kind === 'file' && it.type.startsWith('image/')
    );
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    e.preventDefault();
    void handleUpload(file);
  };

  const onDrop = (e: DragEvent<HTMLTextAreaElement>): void => {
    if (!onUploadImage) return;
    const file = Array.from(e.dataTransfer?.files ?? []).find((f) => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    void handleUpload(file);
  };

  return (
    <Tabs
      activeKey={tab}
      onChange={(k) => setTab(k as typeof tab)}
      size="small"
      items={[
        {
          key: 'write',
          label: t('markdown.write'),
          children: (
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Input.TextArea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                onBlur={onBlur}
                onPaste={onPaste}
                onDrop={onDrop}
                rows={rows}
                maxLength={maxLength}
                placeholder={placeholder}
              />
              <Space
                size="small"
                style={{
                  fontSize: 12,
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  <InfoCircleOutlined /> {t('markdown.supportHint')}
                </Typography.Text>
                {onUploadImage && (
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    disabled={uploading}
                    beforeUpload={(file) => {
                      void handleUpload(file);
                      return false;
                    }}
                  >
                    <Typography.Link style={{ fontSize: 12 }} disabled={uploading}>
                      <PictureOutlined /> {uploading ? t('markdown.uploading') : t('markdown.insertImage')}
                    </Typography.Link>
                  </Upload>
                )}
              </Space>
            </Space>
          ),
        },
        {
          key: 'preview',
          label: t('markdown.preview'),
          children: value.trim() ? (
            <div
              style={{
                padding: '8px 12px',
                minHeight: rows * 22,
                border: '1px solid transparent',
              }}
            >
              <MarkdownRenderer content={value} />
            </div>
          ) : (
            <Typography.Text type="secondary" style={{ padding: '8px 12px', display: 'block' }}>
              {t('markdown.emptyPreview')}
            </Typography.Text>
          ),
        },
      ]}
    />
  );
});

export default MarkdownEditor;
