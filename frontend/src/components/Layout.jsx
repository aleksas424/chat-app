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
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg shadow transition-all duration-150 hover:bg-red-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                title="Atsijungti"
                aria-label="Atsijungti"
                tabIndex={0}
                onClick={() => {
                  localStorage.removeItem('token');
                  window.location.href = '/login';
                }}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span className="hidden sm:inline">Atsijungti</span>
              </button>
            </div>
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