import { LogOut, User as UserIcon } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { ActiveView } from '../types/campussave';

interface HeaderProps {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  user: User | null;
  displayName?: string;
  isAdmin: boolean;
  isMerchant: boolean;
  activeOrderCount: number;
  authLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function Header({
  activeView,
  onNavigate,
  user,
  displayName,
  isAdmin,
  isMerchant,
  activeOrderCount,
  authLoading,
  onSignIn,
  onSignOut,
}: HeaderProps) {
  const navItems: {
    id: ActiveView;
    label: string;
    visible: boolean;
  }[] = [
    { id: 'portals', label: 'Espaces', visible: Boolean(user && isAdmin) },
    { id: 'offers', label: 'Offres', visible: true },
    { id: 'radar', label: 'Campus Radar', visible: true },
    {
      id: 'orders',
      label: activeOrderCount > 0 ? `Mes Commandes (${activeOrderCount})` : 'Mes Commandes',
      visible: Boolean(user),
    },
    {
      id: 'impact',
      label: 'Impact',
      visible: Boolean(user),
    },
    {
      id: 'merchant',
      label: 'Commerçant',
      visible: Boolean(user && (isMerchant || isAdmin)),
    },
    {
      id: 'admin',
      label: 'Administration',
      visible: Boolean(user && isAdmin),
    },
  ];

  const visibleItems = navItems.filter((item) => item.visible);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onNavigate('offers')}
          className="text-xl font-bold tracking-tight text-neutral-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534] rounded-md"
        >
          CampusSave
        </button>

        <nav
          aria-label="Navigation principale"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {visibleItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative py-5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534] rounded-sm ${
                  isActive
                    ? 'text-[#166534] font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-[#166534]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {!user ? (
            <button
              type="button"
              disabled={authLoading}
              onClick={onSignIn}
              className="px-4 py-2 text-sm font-medium text-white bg-[#166534] rounded-lg hover:bg-[#14532d] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#166534]"
            >
              {authLoading ? 'Connexion...' : 'Connexion'}
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-sm text-neutral-700 max-w-[180px]">
                <UserIcon className="w-4 h-4 text-[#166534] shrink-0" />
                <span className="truncate font-medium">
                  {displayName || user.displayName || user.email?.split('@')[0]}
                </span>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534]"
                title="Se déconnecter"
              >
                <LogOut className="w-4 h-4" />
                <span>Déconnexion</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile secondary single-line navigation */}
      <div className="md:hidden border-t border-neutral-100 px-4 overflow-x-auto">
        <div className="flex items-center gap-5 h-11 text-xs font-medium">
          {visibleItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`py-2.5 whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                  isActive
                    ? 'border-[#166534] text-[#166534] font-semibold'
                    : 'border-transparent text-neutral-600'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
