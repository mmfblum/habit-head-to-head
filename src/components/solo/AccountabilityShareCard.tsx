import { useState } from 'react';
import { Eye, Link2, RefreshCcw, Share2, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAccountabilityShare } from '@/hooks/useAccountabilityShare';
import { shareZrizinLink } from '@/lib/nativeShare';
import { toast } from 'sonner';

interface AccountabilityShareCardProps {
  leagueId: string;
}

export function AccountabilityShareCard({ leagueId }: AccountabilityShareCardProps) {
  const { data: existingShare, isLoading, create, revoke } = useAccountabilityShare(leagueId);
  const [working, setWorking] = useState(false);
  const activeToken = existingShare?.is_active ? existingShare.token : null;
  const activeUrl = activeToken ? `${window.location.origin}/accountability/${activeToken}` : null;

  const handleShare = async () => {
    setWorking(true);
    try {
      const token = activeToken ?? await create.mutateAsync();
      const url = `${window.location.origin}/accountability/${token}`;
      const result = await shareZrizinLink({
        title: 'My Zrizin Accountability',
        text: 'I put my goals on the record. Check whether I am actually keeping them on Zrizin.',
        url,
      });
      if (result === 'copied') toast.success('Accountability link copied');
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        toast.error(error instanceof Error ? error.message : 'Could not share progress');
      }
    } finally {
      setWorking(false);
    }
  };

  const handleCopy = async () => {
    if (!activeUrl) return;
    await navigator.clipboard.writeText(activeUrl);
    toast.success('Accountability link copied');
  };

  const handleRotate = async () => {
    try {
      const token = await create.mutateAsync();
      await navigator.clipboard.writeText(`${window.location.origin}/accountability/${token}`);
      toast.success('New private link created. The old one no longer works.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not rotate link');
    }
  };

  const handleRevoke = async () => {
    try {
      await revoke.mutateAsync();
      toast.success('Public accountability link closed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not close link');
    }
  };

  return (
    <section className="rounded-2xl border border-secondary/25 bg-gradient-to-br from-secondary/10 to-card p-5">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0"><Eye className="w-5 h-5 text-secondary" /></div>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.16em] text-secondary font-bold">Accountability</p>
          <h3 className="font-display font-bold text-lg mt-0.5">Put your goals on the record</h3>
          <p className="text-xs text-muted-foreground mt-1">Share a live page showing what you committed to and whether you are hitting it today.</p>
        </div>
      </div>

      <Button className="w-full mt-4 h-11 gap-2" onClick={handleShare} disabled={working || isLoading || create.isPending}>
        <Share2 className="w-4 h-4" />
        {working ? 'Opening share sheet…' : 'Share to WhatsApp, Instagram, X & more'}
      </Button>

      {activeUrl ? (
        <div className="mt-3 space-y-2">
          <button type="button" onClick={handleCopy} className="w-full rounded-lg bg-background/70 border border-border px-3 py-2 flex items-center gap-2 text-left">
            <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate flex-1">{activeUrl}</span>
            <span className="text-[10px] font-semibold text-primary">Copy</span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={handleRotate} disabled={create.isPending} className="gap-1.5"><RefreshCcw className="w-3.5 h-3.5" />New link</Button>
            <Button variant="outline" size="sm" onClick={handleRevoke} disabled={revoke.isPending} className="gap-1.5 text-loss border-loss/25 hover:bg-loss/10"><ShieldOff className="w-3.5 h-3.5" />Stop sharing</Button>
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground text-center mt-3">Nothing is public until you tap Share.</p>
      )}
    </section>
  );
}
