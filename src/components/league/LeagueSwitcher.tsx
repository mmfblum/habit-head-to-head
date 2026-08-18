import { ChevronDown, Plus, Swords, ListOrdered, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { UserLeagueMembership } from '@/hooks/useLeagueDetails';

export function LeagueSwitcher({ currentLeagueId, currentName, memberships, onSelect, onCreate }: { currentLeagueId:string; currentName:string; memberships:UserLeagueMembership[]; onSelect:(leagueId:string)=>void; onCreate:()=>void }) {
  if (memberships.length <= 1) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="font-display font-bold text-xl">{currentName}</h1>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
          aria-label="Create another league"
        >
          <Plus className="w-3 h-3" />
          New league
        </button>
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="flex items-center gap-1 text-left">
          <h1 className="font-display font-bold text-xl">{currentName}</h1>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <p className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Your leagues</p>
        <div className="space-y-1">
          {memberships.map((membership) => {
            const item = membership.leagues;
            if (!item) return null;
            const Icon = item.game_format === 'solo' ? UserRound : item.game_format === 'leaderboard' ? ListOrdered : Swords;
            const selected = membership.league_id === currentLeagueId;
            return (
              <button
                key={membership.league_id}
                type="button"
                onClick={() => onSelect(membership.league_id)}
                className={`w-full rounded-xl p-2.5 flex items-center gap-3 text-left ${selected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"><Icon className="w-4 h-4" /></div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{String(item.game_format || 'head_to_head').replaceAll('_', ' ')}</p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="border-t border-border mt-2 pt-2">
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={onCreate}>
            <Plus className="w-4 h-4" />
            Create another league
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
