import { Outlet } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

const HEADER_HEIGHT = 64; // px

const Layout = () => {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="fixed top-0 left-0 w-full z-50 bg-white dark:bg-gray-800 shadow">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center" style={{ height: `${HEADER_HEIGHT}px` }}>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Pokalbių sistema
            </h1>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main
        className="flex flex-col"
        style={{ paddingTop: `${HEADER_HEIGHT}px`, height: `calc(100vh - ${HEADER_HEIGHT}px)` }}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default Layout; 