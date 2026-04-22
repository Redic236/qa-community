export type Role = 'user' | 'admin';

export interface User {
  id: number;
  username: string;
  email: string;
  avatar: string | null;
  points: number;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export type ReportReason = 'spam' | 'offensive' | 'off_topic' | 'duplicate' | 'other';
export type ReportStatus = 'pending' | 'reviewed_kept' | 'reviewed_removed';

export interface Report {
  id: number;
  reporterId: number;
  targetType: VoteTargetType;
  targetId: number;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  reviewerId: number | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface Question {
  id: number;
  title: string;
  content: string;
  tags: string[];
  authorId: number;
  views: number;
  answersCount: number;
  votes: number;
  isSolved: boolean;
  createdAt: string;
  updatedAt: string;
  liked?: boolean;
}

export interface Answer {
  id: number;
  content: string;
  questionId: number;
  authorId: number;
  votes: number;
  isAccepted: boolean;
  createdAt: string;
  updatedAt: string;
  liked?: boolean;
}

export interface Comment {
  id: number;
  content: string;
  targetType: VoteTargetType;
  targetId: number;
  authorId: number;
  createdAt: string;
}

export interface AnswerWithComments extends Answer {
  comments?: Comment[];
}

export interface QuestionDetail extends Question {
  answers: AnswerWithComments[];
  comments?: Comment[];
}

export type NotificationType =
  | 'question_answered'
  | 'answer_accepted'
  | 'question_liked'
  | 'answer_liked'
  | 'content_removed';

export interface AppNotification {
  id: number;
  userId: number;
  type: NotificationType;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface NotificationListResult {
  items: AppNotification[];
  total: number;
  page: number;
  limit: number;
  unread: number;
}

export type QuestionSort = 'latest' | 'popular' | 'unsolved';
export type VoteTargetType = 'question' | 'answer';
export type PointType = 'ask' | 'answer' | 'accept' | 'like_question' | 'like_answer';

export interface PointRecord {
  id: number;
  userId: number;
  type: PointType;
  points: number;
  relatedId: number | null;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiOk<T> {
  success: true;
  data: T;
  meta?: { total: number; page: number; limit: number };
}

export interface ApiErr {
  success: false;
  error: string;
  details?: Record<string, string[]>;
}

export type ApiEnvelope<T> = ApiOk<T> | ApiErr;

export interface AuthResult {
  user: User;
  token: string;
}

export interface ListQuestionsArgs {
  sort?: QuestionSort;
  tag?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface ListQuestionsResponse {
  items: Question[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminStatsKpis {
  users: number;
  questions: number;
  answers: number;
  comments: number;
  pendingReports: number;
  newUsers7d: number;
  newQuestions7d: number;
}

export interface AdminDailyBucket {
  date: string;
  questions: number;
  answers: number;
  comments: number;
  newUsers: number;
}

export interface AdminTopUser {
  id: number;
  username: string;
  points: number;
}

export interface AdminTopTag {
  tag: string;
  count: number;
}

export interface AdminStats {
  kpis: AdminStatsKpis;
  daily: AdminDailyBucket[];
  topUsers: AdminTopUser[];
  topTags: AdminTopTag[];
}
