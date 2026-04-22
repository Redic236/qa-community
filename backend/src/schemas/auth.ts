import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().max(100),
  password: z.string().min(6).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;

// Avatar accepts full http(s) URLs OR relative `/uploads/...` paths (same
// origin, for server-side uploads). Null/empty string clear the avatar.
const avatarSchema = z
  .string()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\//i.test(v) || v.startsWith('/uploads/'), {
    message: 'Avatar must be an http(s) URL or a server upload path',
  });

export const updateProfileSchema = z
  .object({
    username: z.string().min(3).max(50).optional(),
    avatar: avatarSchema.nullable().optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: z.string().min(6).max(100).optional(),
  })
  .refine((data) => !data.newPassword || !!data.currentPassword, {
    message: '修改密码需要提供当前密码',
    path: ['currentPassword'],
  })
  .refine(
    (data) =>
      data.username !== undefined ||
      data.avatar !== undefined ||
      data.newPassword !== undefined,
    { message: '至少需要修改一个字段' }
  );

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
