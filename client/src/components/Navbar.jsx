import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/fixtures', label: 'Fixtures' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/predictions', label: 'My Predictions' },
  { to: '/rules', label: 'Rules' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <NavLink to="/fixtures" className="flex items-center gap-2 text-xl font-bold text-emerald-400">
          <span>⚽</span>
          <span>Kickoff</span>
        </NavLink>

        <div className="flex items-center gap-6">
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

        <div className="flex items-center gap-3">
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
      </div>
    </nav>
  );
}
