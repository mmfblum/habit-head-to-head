import { useState } from 'react';
import { Plus, Skull, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePunishmentOptions } from '@/hooks/usePunishmentOptions';
import { toast } from 'sonner';

interface PunishmentSettingsCardProps {
  leagueId: string;
  isAdmin: boolean;
}

export function PunishmentSettingsCard({ leagueId, isAdmin }: PunishmentSettingsCardProps) {
  const { data: options = [], isLoading, add, remove } = usePunishmentOptions(leagueId);
  const [adding, setAdding] = useState(false);
  const [emoji, setEmoji] = useState('🎲');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const defaults = options.filter((option) => option.league_id === null);
  const custom = options.filter((option) => option.league_id === leagueId);

  const handleAdd = async () => {
    if (!label.trim() || !description.trim()) {
      toast.error('Add a name and a clear consequence');
      return;
    }
    try {
      await add.mutateAsync({ label: label.trim(), description: description.trim(), emoji: emoji.trim() || '🎲' });
      setLabel('');
      setDescription('');
      setEmoji('🎲');
      setAdding(false);
      toast.success('Custom punishment added to the wheel');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add punishment');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success('Custom punishment removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove punishment');
    }
  };

  return (
    <section className="rounded-2xl border border-loss/20 bg-loss/5 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-loss/15 flex items-center justify-center shrink-0"><Skull className="w-5 h-5 text-loss" /></div>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.16em] text-loss font-bold">Weekly consequences</p>
          <h3 className="font-display font-bold text-base mt-0.5">Punishment Wheel</h3>
          <p className="text-xs text-muted-foreground mt-1">{defaults.length} safe defaults{custom.length ? ` + ${custom.length} league custom` : ''}. One spin, no rerolls.</p>
        </div>
        {isAdmin && !adding && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        )}
      </div>

      {custom.length > 0 && (
        <div className="mt-4 space-y-2">
          {custom.map((option) => (
            <div key={option.id} className="rounded-xl border border-border bg-background/70 p-3 flex items-center gap-3">
              <span className="text-xl">{option.emoji}</span>
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{option.label}</p><p className="text-[11px] text-muted-foreground line-clamp-1">{option.description}</p></div>
              {isAdmin && (
                <button type="button" onClick={() => handleRemove(option.id)} disabled={remove.isPending} className="w-8 h-8 rounded-lg hover:bg-loss/10 flex items-center justify-center text-loss" aria-label={`Remove ${option.label}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && isAdmin && (
        <div className="mt-4 rounded-xl border border-border bg-background/70 p-3 space-y-3">
          <div className="grid grid-cols-[72px_1fr] gap-2">
            <div className="space-y-1"><Label htmlFor="punishment-emoji">Emoji</Label><Input id="punishment-emoji" value={emoji} onChange={(event) => setEmoji(event.target.value.slice(0, 4))} maxLength={4} /></div>
            <div className="space-y-1"><Label htmlFor="punishment-name">Name</Label><Input id="punishment-name" value={label} onChange={(event) => setLabel(event.target.value.slice(0, 60))} placeholder="Coffee debt" /></div>
          </div>
          <div className="space-y-1"><Label htmlFor="punishment-description">What does the loser owe?</Label><Textarea id="punishment-description" value={description} onChange={(event) => setDescription(event.target.value.slice(0, 240))} placeholder="Buy the winner a coffee before next kickoff." rows={2} /></div>
          <p className="text-[10px] text-muted-foreground">Keep custom consequences consensual, legal, and safe. Avoid dangerous exercise, humiliation, money you would not comfortably spend, or forced public posting.</p>
          <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button><Button onClick={handleAdd} disabled={add.isPending}>{add.isPending ? 'Adding…' : 'Add to Wheel'}</Button></div>
        </div>
      )}
    </section>
  );
}
