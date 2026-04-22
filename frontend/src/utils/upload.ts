import { store } from '@/store';
import i18n from '@/i18n';

/**
 * Posts a single image to `/api/uploads/image` and returns the public URL
 * the backend saved it at. Uses raw fetch rather than RTK Query because
 * RTK Query's JSON default doesn't compose well with FormData + file blobs.
 *
 * Backend enforces size / mime / auth — we still do a cheap pre-check so
 * users get instant feedback without a round-trip.
 */
export async function uploadImage(file: File): Promise<string> {
  const MAX = 5 * 1024 * 1024;
  if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) {
    throw new Error(i18n.t('markdown.uploadBadType'));
  }
  if (file.size > MAX) {
    throw new Error(i18n.t('markdown.uploadTooLarge'));
  }

  const token = store.getState().auth.token;
  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/api/uploads/image', {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Accept-Language': i18n.language || 'zh-CN',
    },
    body: form,
  });

  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { url?: string };
    error?: string;
  };

  if (!res.ok || !body.success || !body.data?.url) {
    throw new Error(body.error || i18n.t('markdown.uploadFailed'));
  }
  return body.data.url;
}
