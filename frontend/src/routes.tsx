import { createBrowserRouter, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminRoute from '@/components/AdminRoute';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import QuestionDetailPage from '@/pages/QuestionDetailPage';
import AskQuestionPage from '@/pages/AskQuestionPage';
import ProfilePage from '@/pages/ProfilePage';
import AdminReportsPage from '@/pages/AdminReportsPage';
import AdminDashboardPage from '@/pages/AdminDashboardPage';
import LeaderboardPage from '@/pages/LeaderboardPage';
import NotFoundPage from '@/pages/NotFoundPage';

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
      { path: 'profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
      { path: 'admin', element: <AdminRoute><AdminDashboardPage /></AdminRoute> },
      { path: 'admin/dashboard', element: <Navigate to="/admin" replace /> },
      { path: 'admin/reports', element: <AdminRoute><AdminReportsPage /></AdminRoute> },
      { path: '404', element: <NotFoundPage /> },
      { path: '*', element: <Navigate to="/404" replace /> },
    ],
  },
]);
