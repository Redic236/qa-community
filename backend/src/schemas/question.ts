import { z } from 'zod';

export const createQuestionSchema = z.object({
  title: z.string().min(5).max(200),
  content: z.string().min(10),
  tags: z.array(z.string().min(1).max(50)).max(5).optional(),
});

export type CreateQuestionBody = z.infer<typeof createQuestionSchema>;

export const updateQuestionSchema = z
  .object({
    title: z.string().min(5).max(200).optional(),
    content: z.string().min(10).optional(),
    tags: z.array(z.string().min(1).max(50)).max(5).optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined || data.content !== undefined || data.tags !== undefined,
    { message: '至少需要修改一个字段' }
  );

export type UpdateQuestionBody = z.infer<typeof updateQuestionSchema>;

export const listQuestionsSchema = z.object({
  sort: z.enum(['latest', 'popular', 'unsolved']).optional().default('latest'),
  tag: z.string().min(1).max(50).optional(),
  q: z.string().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export type ListQuestionsQuery = z.infer<typeof listQuestionsSchema>;
