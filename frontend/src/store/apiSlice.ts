import { createApi, fetchBaseQuery, type BaseQueryFn } from '@reduxjs/toolkit/query/react';
import type { FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import i18n from '@/i18n';
import type { RootState } from './index';
import { logout } from './authSlice';
import type {
  ApiOk,
  AuthResult,
  Question,
  QuestionDetail,
  Answer,
  User,
  ListQuestionsArgs,
  ListQuestionsResponse,
  VoteTargetType,
  PointRecord,
  PaginatedResult,
  Report,
  ReportReason,
  ReportStatus,
  Comment,
  AppNotification,
  NotificationListResult,
  AdminStats,
} from '@/types/models';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    // Match the UI language so backend errors come back in the same locale.
    headers.set('Accept-Language', i18n.language || 'zh-CN');
    return headers;
  },
});

// Wrap to auto-logout on 401 so stale/expired tokens don't leave the UI stuck.
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401 && (api.getState() as RootState).auth.token) {
    api.dispatch(logout());
  }
  return result;
};

// Unwrap the backend's { success, data, meta } envelope into the data alone,
// so hooks just see Question / Answer / etc. Errors bubble via the standard error channel.
function unwrap<T>(res: ApiOk<T>): T {
  return res.data;
}

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: [
    'Question',
    'QuestionList',
    'Me',
    'Points',
    'Reports',
    'Notifications',
    'AdminStats',
  ],
  endpoints: (build) => ({
    register: build.mutation<AuthResult, { username: string; email: string; password: string }>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
      transformResponse: (r: ApiOk<AuthResult>) => unwrap(r),
    }),
    login: build.mutation<AuthResult, { email: string; password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      transformResponse: (r: ApiOk<AuthResult>) => unwrap(r),
    }),
    me: build.query<User, void>({
      query: () => '/auth/me',
      transformResponse: (r: ApiOk<User>) => unwrap(r),
      providesTags: ['Me'],
    }),

    updateProfile: build.mutation<
      User,
      {
        username?: string;
        avatar?: string | null;
        currentPassword?: string;
        newPassword?: string;
      }
    >({
      query: (body) => ({ url: '/auth/me', method: 'PATCH', body }),
      transformResponse: (r: ApiOk<User>) => unwrap(r),
      invalidatesTags: ['Me'],
    }),

    listQuestions: build.query<ListQuestionsResponse, ListQuestionsArgs>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args.sort) params.set('sort', args.sort);
        if (args.tag) params.set('tag', args.tag);
        if (args.q) params.set('q', args.q);
        if (args.page) params.set('page', String(args.page));
        if (args.limit) params.set('limit', String(args.limit));
        const qs = params.toString();
        return qs ? `/questions?${qs}` : '/questions';
      },
      transformResponse: (r: ApiOk<Question[]>) => ({
        items: r.data,
        total: r.meta?.total ?? r.data.length,
        page: r.meta?.page ?? 1,
        limit: r.meta?.limit ?? r.data.length,
      }),
      providesTags: ['QuestionList'],
    }),

    getQuestion: build.query<QuestionDetail, number>({
      query: (id) => `/questions/${id}`,
      transformResponse: (r: ApiOk<QuestionDetail>) => unwrap(r),
      providesTags: (_res, _err, id) => [{ type: 'Question', id }],
    }),

    createQuestion: build.mutation<
      Question,
      { title: string; content: string; tags?: string[] }
    >({
      query: (body) => ({ url: '/questions', method: 'POST', body }),
      transformResponse: (r: ApiOk<Question>) => unwrap(r),
      invalidatesTags: ['QuestionList', 'Me', 'Points'],
    }),

    updateQuestion: build.mutation<
      Question,
      { id: number; title?: string; content?: string; tags?: string[] }
    >({
      query: ({ id, ...body }) => ({ url: `/questions/${id}`, method: 'PATCH', body }),
      transformResponse: (r: ApiOk<Question>) => unwrap(r),
      invalidatesTags: (_res, _err, { id }) => [{ type: 'Question', id }, 'QuestionList'],
    }),

    deleteQuestion: build.mutation<{ id: number }, number>({
      query: (id) => ({ url: `/questions/${id}`, method: 'DELETE' }),
      transformResponse: (r: ApiOk<{ id: number }>) => unwrap(r),
      invalidatesTags: (_res, _err, id) => [{ type: 'Question', id }, 'QuestionList'],
    }),

    createAnswer: build.mutation<Answer, { questionId: number; content: string }>({
      query: ({ questionId, content }) => ({
        url: `/questions/${questionId}/answers`,
        method: 'POST',
        body: { content },
      }),
      transformResponse: (r: ApiOk<Answer>) => unwrap(r),
      invalidatesTags: (_res, _err, { questionId }) => [
        { type: 'Question', id: questionId },
        'QuestionList',
        'Me',
        'Points',
      ],
    }),

    updateAnswer: build.mutation<
      Answer,
      { answerId: number; questionId: number; content: string }
    >({
      query: ({ answerId, content }) => ({
        url: `/answers/${answerId}`,
        method: 'PATCH',
        body: { content },
      }),
      transformResponse: (r: ApiOk<Answer>) => unwrap(r),
      invalidatesTags: (_res, _err, { questionId }) => [{ type: 'Question', id: questionId }],
    }),

    deleteAnswer: build.mutation<{ id: number }, { answerId: number; questionId: number }>({
      query: ({ answerId }) => ({ url: `/answers/${answerId}`, method: 'DELETE' }),
      transformResponse: (r: ApiOk<{ id: number }>) => unwrap(r),
      invalidatesTags: (_res, _err, { questionId }) => [
        { type: 'Question', id: questionId },
        'QuestionList',
      ],
    }),

    acceptAnswer: build.mutation<Answer, { answerId: number; questionId: number }>({
      query: ({ answerId }) => ({ url: `/answers/${answerId}/accept`, method: 'POST' }),
      transformResponse: (r: ApiOk<Answer>) => unwrap(r),
      invalidatesTags: (_res, _err, { questionId }) => [
        { type: 'Question', id: questionId },
        'QuestionList',
        'Me',
        'Points',
      ],
    }),

    unacceptAnswer: build.mutation<Answer, { answerId: number; questionId: number }>({
      query: ({ answerId }) => ({ url: `/answers/${answerId}/accept`, method: 'DELETE' }),
      transformResponse: (r: ApiOk<Answer>) => unwrap(r),
      invalidatesTags: (_res, _err, { questionId }) => [
        { type: 'Question', id: questionId },
        'QuestionList',
      ],
    }),

    toggleVote: build.mutation<
      { liked: boolean; votes: number },
      { targetType: VoteTargetType; targetId: number; questionId: number }
    >({
      query: ({ targetType, targetId }) => ({
        url: '/votes',
        method: 'POST',
        body: { targetType, targetId },
      }),
      transformResponse: (r: ApiOk<{ liked: boolean; votes: number }>) => unwrap(r),
      invalidatesTags: (_res, _err, { questionId }) => [
        { type: 'Question', id: questionId },
        'QuestionList',
        'Me',
        'Points',
      ],
    }),

    submitReport: build.mutation<
      Report,
      { targetType: VoteTargetType; targetId: number; reason: ReportReason; details?: string }
    >({
      query: (body) => ({ url: '/reports', method: 'POST', body }),
      transformResponse: (r: ApiOk<Report>) => unwrap(r),
      invalidatesTags: ['Reports'],
    }),

    listReports: build.query<
      PaginatedResult<Report>,
      { status?: ReportStatus; page?: number; limit?: number }
    >({
      query: ({ status, page, limit }) => {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (page) params.set('page', String(page));
        if (limit) params.set('limit', String(limit));
        const qs = params.toString();
        return qs ? `/reports?${qs}` : '/reports';
      },
      transformResponse: (r: ApiOk<Report[]>) => ({
        items: r.data,
        total: r.meta?.total ?? r.data.length,
        page: r.meta?.page ?? 1,
        limit: r.meta?.limit ?? r.data.length,
      }),
      providesTags: ['Reports'],
    }),

    reviewReport: build.mutation<Report, { id: number; action: 'keep' | 'remove' }>({
      query: ({ id, action }) => ({
        url: `/reports/${id}/review`,
        method: 'POST',
        body: { action },
      }),
      transformResponse: (r: ApiOk<Report>) => unwrap(r),
      invalidatesTags: ['Reports', 'QuestionList'],
    }),

    createComment: build.mutation<
      Comment,
      { targetType: VoteTargetType; targetId: number; content: string; questionId: number }
    >({
      query: ({ targetType, targetId, content }) => ({
        url: '/comments',
        method: 'POST',
        body: { targetType, targetId, content },
      }),
      transformResponse: (r: ApiOk<Comment>) => unwrap(r),
      invalidatesTags: (_res, _err, { questionId }) => [{ type: 'Question', id: questionId }],
    }),

    deleteComment: build.mutation<{ id: number }, { id: number; questionId: number }>({
      query: ({ id }) => ({ url: `/comments/${id}`, method: 'DELETE' }),
      transformResponse: (r: ApiOk<{ id: number }>) => unwrap(r),
      invalidatesTags: (_res, _err, { questionId }) => [{ type: 'Question', id: questionId }],
    }),

    listNotifications: build.query<
      NotificationListResult,
      { unread?: boolean; page?: number; limit?: number }
    >({
      query: ({ unread, page, limit }) => {
        const params = new URLSearchParams();
        if (unread) params.set('unread', 'true');
        if (page) params.set('page', String(page));
        if (limit) params.set('limit', String(limit));
        const qs = params.toString();
        return qs ? `/notifications?${qs}` : '/notifications';
      },
      transformResponse: (r: ApiOk<AppNotification[]>) => ({
        items: r.data,
        total: r.meta?.total ?? r.data.length,
        page: r.meta?.page ?? 1,
        limit: r.meta?.limit ?? r.data.length,
        unread: (r.meta as { unread?: number } | undefined)?.unread ?? 0,
      }),
      providesTags: ['Notifications'],
    }),

    markNotificationsRead: build.mutation<
      { affected: number },
      { all: true } | { ids: number[] }
    >({
      query: (body) => ({ url: '/notifications/mark-read', method: 'POST', body }),
      transformResponse: (r: ApiOk<{ affected: number }>) => unwrap(r),
      invalidatesTags: ['Notifications'],
    }),

    getAdminStats: build.query<AdminStats, { days?: 7 | 30 | 90 } | void>({
      query: (arg) => {
        const days = arg && 'days' in arg && arg.days ? arg.days : 30;
        return `/admin/stats?days=${days}`;
      },
      transformResponse: (r: ApiOk<AdminStats>) => unwrap(r),
      providesTags: ['AdminStats'],
    }),

    listMyPoints: build.query<PaginatedResult<PointRecord>, { page?: number; limit?: number }>({
      query: ({ page, limit }) => {
        const params = new URLSearchParams();
        if (page) params.set('page', String(page));
        if (limit) params.set('limit', String(limit));
        const qs = params.toString();
        return qs ? `/users/me/points?${qs}` : '/users/me/points';
      },
      transformResponse: (r: ApiOk<PointRecord[]>) => ({
        items: r.data,
        total: r.meta?.total ?? r.data.length,
        page: r.meta?.page ?? 1,
        limit: r.meta?.limit ?? r.data.length,
      }),
      providesTags: ['Points'],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useMeQuery,
  useListQuestionsQuery,
  useGetQuestionQuery,
  useCreateQuestionMutation,
  useUpdateProfileMutation,
  useUpdateQuestionMutation,
  useDeleteQuestionMutation,
  useCreateAnswerMutation,
  useUpdateAnswerMutation,
  useDeleteAnswerMutation,
  useAcceptAnswerMutation,
  useUnacceptAnswerMutation,
  useToggleVoteMutation,
  useListMyPointsQuery,
  useSubmitReportMutation,
  useListReportsQuery,
  useReviewReportMutation,
  useCreateCommentMutation,
  useDeleteCommentMutation,
  useListNotificationsQuery,
  useMarkNotificationsReadMutation,
  useGetAdminStatsQuery,
} = apiSlice;
