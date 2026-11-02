import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-white">页面不存在</h1>
      <p className="text-sm text-slate-400">你访问的页面可能已被删除或从未存在。</p>
      <Link
        to="/"
        className="rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-400"
      >
        返回首页
      </Link>
    </div>
  );
}
