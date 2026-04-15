import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Package, CreditCard, Users, Settings } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { cn, titleCase } from '@/lib/utils';
import type { UserRole } from '@/lib/database.types';
import type { ReactNode } from 'react';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles: UserRole[];
}

const NAV: NavItem[] = [
  { to: '/dashboard/orders', label: 'Orders', icon: <Package className="h-4 w-4" />, roles: ['manager', 'production', 'bookstore'] },
  { to: '/dashboard/rate-card', label: 'Rate card', icon: <CreditCard className="h-4 w-4" />, roles: ['manager'] },
  { to: '/dashboard/users', label: 'Users', icon: <Users className="h-4 w-4" />, roles: ['manager'] },
  { to: '/dashboard/settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, roles: ['manager'] },
];

export function DashboardLayout() {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const items = NAV.filter((n) => role && n.roles.includes(role));

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r bg-white">
        <div className="border-b p-4">
          <Logo />
        </div>
        <nav className="p-3">
          <ul className="space-y-1">
            {items.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                      isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-brand-snow'
                    )
                  }
                >
                  {n.icon}
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-white px-6 py-3">
          <div>
            <div className="font-display text-lg font-semibold">SAIACS POD</div>
            <div className="text-xs text-muted-foreground">
              {profile?.name} · {role ? titleCase(role) : '—'}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
