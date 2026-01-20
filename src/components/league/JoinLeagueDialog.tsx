import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useJoinLeague } from '@/hooks/useLeagues';
import { toast } from 'sonner';

interface JoinLeagueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JoinLeagueDialog({ open, onOpenChange }: JoinLeagueDialogProps) {
  const [inviteCode, setInviteCode] = useState('');
  const joinLeague = useJoinLeague();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code');
      return;
    }

    try {
      const league = await joinLeague.mutateAsync(inviteCode);
      toast.success(`Joined ${league.name}!`);
      onOpenChange(false);
      navigate('/league');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to join league');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-2">
            <Users className="w-6 h-6 text-secondary" />
          </div>
          <DialogTitle className="text-center font-display">Join a League</DialogTitle>
          <DialogDescription className="text-center">
            Enter the invite code shared by your league admin
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="inviteCode">Invite Code</Label>
            <Input
              id="inviteCode"
              placeholder="abc123"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="text-center text-lg tracking-widest uppercase"
              maxLength={12}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={joinLeague.isPending || !inviteCode.trim()}
          >
            {joinLeague.isPending ? 'Joining...' : 'Join League'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
