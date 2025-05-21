import { Outlet } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

const HEADER_HEIGHT = 64; // px

import { useState } from 'react';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Placeholder for user avatar (replace with actual avatar if available)
  const userAvatar = (
    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-100 font-bold text-lg select-none mr-2">
      <span aria-hidden="true">U</span>
      <span className="sr-only">Naudotojo avataras</span>
    </span>
  );
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="fixed top-0 left-0 w-full z-50 bg-white dark:bg-gray-800 shadow animate-fade-in-down">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center" style={{ height: `${HEADER_HEIGHT}px` }}>
            <div className="flex items-center gap-3">
              {/* Hamburger for mobile sidebar */}
              <button
                className="sm:hidden p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="Atidaryti meniu"
                onClick={() => setSidebarOpen(true)}
                tabIndex={0}
              >
                <svg className="w-6 h-6 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Pokalbių sistema
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {userAvatar}
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
      {/* Sidebar drawer for mobile (placeholder, implement actual sidebar if needed) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-40 flex"
          tabIndex={-1}
          aria-modal="true"
          role="dialog"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="w-64 bg-white dark:bg-gray-900 h-full shadow-lg p-4" onClick={e => e.stopPropagation()}>
            <button
              className="mb-4 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label="Uždaryti meniu"
              onClick={() => setSidebarOpen(false)}
              tabIndex={0}
            >
              <svg className="w-6 h-6 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <nav>
              <ul className="flex flex-col gap-2">
                <li><a href="/" className="block px-2 py-1 rounded hover:bg-blue-100 dark:hover:bg-blue-800 focus:bg-blue-200 dark:focus:bg-blue-900" tabIndex={0}>Pokalbiai</a></li>
                <li><a href="/profile" className="block px-2 py-1 rounded hover:bg-blue-100 dark:hover:bg-blue-800 focus:bg-blue-200 dark:focus:bg-blue-900" tabIndex={0}>Profilis</a></li>
                <li><button onClick={() => {localStorage.removeItem('token'); window.location.href='/login';}} className="block w-full text-left px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-800 text-red-700 dark:text-red-200" tabIndex={0}>Atsijungti</button></li>
              </ul>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout; 