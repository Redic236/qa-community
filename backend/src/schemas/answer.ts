import { z } from 'zod';

export const createAnswerSchema = z.object({
  content: z.string().min(5),
});

export type CreateAnswerBody = z.infer<typeof createAnswerSchema>;

export const updateAnswerSchema = z.object({
  content: z.string().min(5),
});

export type UpdateAnswerBody = z.infer<typeof updateAnswerSchema>;
