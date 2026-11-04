import { useState } from 'react';
import { Check, ChevronDown, ListOrdered, Plus, Swords, UserPlus, UserRound } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CreateLeagueWizard } from '@/components/league/CreateLeagueWizard';
import { JoinLeagueDialog } from '@/components/league/JoinLeagueDialog';
import type { UserLeagueMembership } from '@/hooks/useLeagueDetails';

const ACTIVE_LEAGUE_LIMIT = 3;

export function LeagueSwitcher({
  currentLeagueId,
  currentName,
  memberships,
  onSelect,
}: {
  currentLeagueId: string;
  currentName: string;
  memberships: UserLeagueMembership[];
  onSelect: (leagueId: string) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const atLimit = memberships.length >= ACTIVE_LEAGUE_LIMIT;

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="flex items-center gap-1 text-left" aria-label="Switch league">
            <h1 className="font-display font-bold text-xl truncate max-w-[230px]">{currentName}</h1>
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-2">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Your active leagues</p>
            <span className="text-[10px] text-muted-foreground">{memberships.length}/{ACTIVE_LEAGUE_LIMIT}</span>
          </div>

          <div className="space-y-1 mt-1">
            {memberships.map((membership) => {
              const item = membership.leagues;
              if (!item) return null;
              const Icon = item.game_format === 'solo'
                ? UserRound
                : item.game_format === 'leaderboard'
                  ? ListOrdered
                  : Swords;
              const selected = membership.league_id === currentLeagueId;

              return (
                <button
                  key={membership.league_id}
                  type="button"
                  onClick={() => onSelect(membership.league_id)}
                  className={`w-full rounded-xl p-2.5 flex items-center gap-3 text-left ${
                    selected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {String(item.game_format || 'head_to_head').replaceAll('_', ' ')}
                    </p>
                  </div>
                  {selected && <Check className="w-4 h-4 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="border-t border-border mt-2 pt-2 space-y-1">
            <button
              type="button"
              disabled={atLimit}
              onClick={() => setShowCreate(true)}
              className="w-full rounded-lg px-2.5 py-2 flex items-center gap-2 text-sm font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Create another league
            </button>
            <button
              type="button"
              disabled={atLimit}
              onClick={() => setShowJoin(true)}
              className="w-full rounded-lg px-2.5 py-2 flex items-center gap-2 text-sm font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-4 h-4" />
              Join another league
            </button>
            {atLimit && (
              <p className="px-2.5 pt-1 pb-1 text-[11px] text-muted-foreground">
                You have 3 active leagues. End or leave one to add another.
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {showCreate && <CreateLeagueWizard onClose={() => setShowCreate(false)} />}
      <JoinLeagueDialog open={showJoin} onOpenChange={setShowJoin} />
    </>
  );
}
