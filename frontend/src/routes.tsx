import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminRoute from '@/components/AdminRoute';
// Eagerly load HomePage — it's the default landing and we want zero waterfall
// for the most common entry point.
import HomePage from '@/pages/HomePage';

// Secondary pages are lazy so the initial bundle only ships the home path.
// Admin pages (heavy recharts) are kept in their own chunks via manualChunks.
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const QuestionDetailPage = lazy(() => import('@/pages/QuestionDetailPage'));
const AskQuestionPage = lazy(() => import('@/pages/AskQuestionPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage'));
const AchievementsPage = lazy(() => import('@/pages/AchievementsPage'));
const AdminReportsPage = lazy(() => import('@/pages/AdminReportsPage'));
const AdminDashboardPage = lazy(() => import('@/pages/AdminDashboardPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'questions/new', element: <ProtectedRoute><AskQuestionPage /></ProtectedRoute> },
      { path: 'questions/:id', element: <QuestionDetailPage /> },
      { path: 'leaderboard', element: <LeaderboardPage /> },
      { path: 'achievements', element: <ProtectedRoute><AchievementsPage /></ProtectedRoute> },
      { path: 'profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
      { path: 'admin', element: <AdminRoute><AdminDashboardPage /></AdminRoute> },
      { path: 'admin/dashboard', element: <Navigate to="/admin" replace /> },
      { path: 'admin/reports', element: <AdminRoute><AdminReportsPage /></AdminRoute> },
      { path: '404', element: <NotFoundPage /> },
      { path: '*', element: <Navigate to="/404" replace /> },
    ],
  },
]);
