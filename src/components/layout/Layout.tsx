import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Sidebar } from './Sidebar';
import { SiteFooter } from './SiteFooter';
import type { ReactNode } from 'react';

export function Layout({ children }: { children: ReactNode }) {
  const theme = useStore((s) => s.theme);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const location = useLocation();

  // Mantener data-theme en <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Cerrar sidebar al navegar (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  const isHome = location.pathname === '/';

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="icon-btn"
              aria-label="Abrir navegación"
              style={{ display: 'inline-flex' }}
            >
              <Menu size={18} />
            </button>
            <Link to="/" className="topbar-brand" aria-label="Inicio Dashboard Venado Tuerto">
              <span>Dashboard Venado Tuerto</span>
            </Link>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {sidebarOpen && (
        <>
          <div className="sidebar-mobile-overlay" onClick={() => setSidebarOpen(false)} />
          <aside className="sidebar-mobile" aria-label="Navegación móvil">
            <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
              <span className="topbar-brand" style={{ fontSize: '1rem' }}>
                Navegación
              </span>
              <button onClick={() => setSidebarOpen(false)} className="icon-btn" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <Sidebar />
          </aside>
        </>
      )}

      <main className="app-main">
        {isHome ? (
          <div className="app-content">{children}</div>
        ) : (
          <div className="app-with-sidebar">
            <aside className="sidebar" aria-label="Navegación principal">
              <Sidebar />
            </aside>
            <div className="app-content">{children}</div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
