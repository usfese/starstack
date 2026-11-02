import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { SITE_NAME, SITE_TAGLINE } from '../../shared/constants';
import { useAuth } from '../context/AuthContext';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 transition-colors ${
    isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
  }`;

export function Layout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0f14]/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-4 py-3">
          <Link to="/" className="shrink-0 text-lg font-semibold tracking-wide text-white">
            {SITE_NAME}
          </Link>
          <nav
            aria-label="主导航"
            className="flex flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap text-sm"
          >
            <NavLink to="/" end className={navLinkClass}>
              首页
            </NavLink>
            <NavLink to="/projects" className={navLinkClass}>
              项目广场
            </NavLink>
            <NavLink to="/leaderboard" className={navLinkClass}>
              周榜
            </NavLink>
            <NavLink to="/submit" className={navLinkClass}>
              提交项目
            </NavLink>
            {user?.isAdmin ? (
              <NavLink to="/admin" className={navLinkClass}>
                管理
              </NavLink>
            ) : null}
          </nav>

          <div className="flex shrink-0 items-center gap-2 text-sm">
            {loading ? null : user ? (
              <>
                <Link to="/me" className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/5">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="h-6 w-6 rounded-full border border-white/20"
                    />
                  ) : null}
                  <span className="hidden text-slate-200 sm:inline">我的</span>
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200 hover:bg-white/10"
                >
                  退出
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-lg bg-indigo-500 px-3 py-1.5 font-medium text-white hover:bg-indigo-400"
              >
                GitHub 登录
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-white/10 py-6 text-center text-xs text-slate-500">
        {SITE_NAME} · {SITE_TAGLINE}
      </footer>
    </div>
  );
}
