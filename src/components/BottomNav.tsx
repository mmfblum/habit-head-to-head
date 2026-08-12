import { Home, Target, Trophy, Swords, MessageSquare } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUserPrimaryLeague } from '@/hooks/useLeagueDetails';

const baseNavItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Swords, label: 'Matchup', path: '/matchup', headToHeadOnly: true },
  { icon: Target, label: 'Tasks', path: '/tasks' },
  { icon: Trophy, label: 'League', path: '/league' },
  { icon: MessageSquare, label: 'Feed', path: '/feed' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: league } = useUserPrimaryLeague();
  const isHeadToHead = league?.game_format === 'head_to_head';
  const isSolo = league?.game_format === 'solo';
  const navItems = baseNavItems.filter((item) => !item.headToHeadOnly || isHeadToHead);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`nav-item flex-1 ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
              <span className="text-[10px] font-medium">{isSolo && item.path === '/league' ? 'Progress' : item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
