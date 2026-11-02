import { createBrowserRouter, Link, RouterProvider } from 'react-router-dom';
import { lazy, Suspense, type ReactNode } from 'react';
import { EmptyState } from './components/EmptyState';
import { Layout } from './components/Layout';
import { Spinner } from './components/Spinner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));
const EditProject = lazy(() => import('./pages/EditProject').then((m) => ({ default: m.EditProject })));
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Leaderboard = lazy(() =>
  import('./pages/Leaderboard').then((m) => ({ default: m.Leaderboard })),
);
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Me = lazy(() => import('./pages/Me').then((m) => ({ default: m.Me })));
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));
const ProjectDetailPage = lazy(() =>
  import('./pages/ProjectDetail').then((m) => ({ default: m.ProjectDetailPage })),
);
const Projects = lazy(() => import('./pages/Projects').then((m) => ({ default: m.Projects })));
const Submit = lazy(() => import('./pages/Submit').then((m) => ({ default: m.Submit })));

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <Spinner />;

  if (!user) {
    return (
      <EmptyState
        title="请先登录后继续"
        action={
          <Link
            to="/login"
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            使用 GitHub 登录
          </Link>
        }
      />
    );
  }

  return <>{children}</>;
}

function RouteError() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-white">页面加载失败</h1>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
      >
        刷新重试
      </button>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      { path: 'projects', element: <Projects /> },
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      {
        path: 'projects/:id/edit',
        element: (
          <RequireAuth>
            <EditProject />
          </RequireAuth>
        ),
      },
      {
        path: 'submit',
        element: (
          <RequireAuth>
            <Submit />
          </RequireAuth>
        ),
      },
      { path: 'leaderboard', element: <Leaderboard /> },
      {
        path: 'me',
        element: (
          <RequireAuth>
            <Me />
          </RequireAuth>
        ),
      },
      {
        path: 'admin',
        element: (
          <RequireAuth>
            <Admin />
          </RequireAuth>
        ),
      },
      { path: 'login', element: <Login /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Suspense fallback={<Spinner />}>
          <RouterProvider router={router} />
        </Suspense>
      </AuthProvider>
    </ToastProvider>
  );
}
