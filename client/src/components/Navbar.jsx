import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/fixtures', label: 'Fixtures' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/predictions', label: 'My Predictions' },
  { to: '/rules', label: 'Rules' },
  { to: '/support', label: 'Support' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <NavLink
          to="/fixtures"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 text-xl font-bold text-emerald-400"
        >
          <span>⚽</span>
          <span>Kickoff</span>
        </NavLink>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-6">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-slate-300 hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-3">
          <span className="text-sm text-slate-400">{user?.name}</span>
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-amber-700 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`
            }
          >
            Admin
          </NavLink>
          <button
            onClick={handleLogout}
            className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-slate-600"
          >
            Logout
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          className="md:hidden rounded-md p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          {open ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-slate-700 bg-slate-900 px-4 pb-4 pt-2 space-y-1">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-emerald-400'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
          <NavLink
            to="/admin"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-slate-800 text-amber-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            Admin
          </NavLink>
          <div className="flex items-center justify-between border-t border-slate-700 pt-3 mt-1">
            <span className="text-sm text-slate-400">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-600"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
