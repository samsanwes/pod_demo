import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Package, CreditCard, Users, Settings, BarChart3, BookOpen, PackagePlus, Menu } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
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
  { to: '/dashboard/new-order', label: 'Place order', icon: <PackagePlus className="h-4 w-4" />, roles: ['manager', 'bookstore'] },
  { to: '/dashboard/reports', label: 'Reports', icon: <BarChart3 className="h-4 w-4" />, roles: ['manager'] },
  { to: '/dashboard/books', label: 'Books', icon: <BookOpen className="h-4 w-4" />, roles: ['manager'] },
  { to: '/dashboard/rate-card', label: 'Rate card', icon: <CreditCard className="h-4 w-4" />, roles: ['manager'] },
  { to: '/dashboard/users', label: 'Users', icon: <Users className="h-4 w-4" />, roles: ['manager'] },
  { to: '/dashboard/settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, roles: ['manager'] },
];

function NavList({ items, onItemClick }: { items: NavItem[]; onItemClick?: () => void }) {
  return (
    <nav className="p-3">
      <ul className="space-y-1">
        {items.map((n) => (
          <li key={n.to}>
            <NavLink
              to={n.to}
              onClick={onItemClick}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors',
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
  );
}

export function DashboardLayout() {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const items = NAV.filter((n) => role && n.roles.includes(role));

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-white md:block">
        <div className="border-b p-4">
          <Logo />
        </div>
        <NavList items={items} />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="border-b p-4">
            <Logo />
          </div>
          <NavList items={items} onItemClick={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b bg-white px-3 py-3 md:px-6">
          {/* Hamburger — mobile only */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-lg font-semibold">SAIACS POD</div>
            <div className="truncate text-xs text-muted-foreground">
              {profile?.name} · {role ? titleCase(role) : '—'}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Sign out</span>
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
