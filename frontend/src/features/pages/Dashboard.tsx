// pages/Dashboard.tsx
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { to: '/posts',     icon: '📅', label: 'Post Manager'       },
  { to: '/caption',  icon: '✨', label: 'Caption Studio'      },
  { to: '/media',    icon: '🗂️', label: 'Media Repository'   },
  { to: '/analytics',icon: '📊', label: 'Analytics'          },
];

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r flex flex-col">
        <div className="p-5 border-b">
          <h1 className="font-bold text-blue-700 text-xl">UGNAY</h1>
          <p className="text-xs text-gray-500 mt-0.5">{user?.orgName}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }: { isActive: boolean }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition
                 ${isActive
                   ? 'bg-blue-600 text-white'
                   : 'text-gray-700 hover:bg-gray-100'}`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t">
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-red-600 rounded-lg"
          >
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}