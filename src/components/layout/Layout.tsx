import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <TopBar />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
