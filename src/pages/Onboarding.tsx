import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Users, Trophy, ArrowRight } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateLeagueWizard } from '@/components/league/CreateLeagueWizard';
import { JoinLeagueDialog } from '@/components/league/JoinLeagueDialog';

export default function Onboarding() {
  const [searchParams] = useSearchParams();
  const invitedCode = searchParams.get('join')?.trim().toUpperCase() || '';
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(!!invitedCode);

  useEffect(() => {
    if (invitedCode) setShowJoinDialog(true);
  }, [invitedCode]);

  if (showCreateWizard) {
    return <CreateLeagueWizard onClose={() => setShowCreateWizard(false)} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 pb-24">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <Trophy className="w-16 h-16 text-primary mx-auto mb-4" />
        <h1 className="text-3xl font-display font-bold mb-2">Welcome to Zrizin</h1>
        <p className="text-muted-foreground max-w-md">
          Turn better habits into a weekly rivalry. Score your day, beat your friends, and win the week.
        </p>
        {invitedCode && (
          <div className="mt-4 inline-flex rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1.5 text-xs font-semibold text-secondary">
            League invitation ready · {invitedCode}
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-md space-y-4"
      >
        <Card
          className="border-primary/30 hover:border-primary/60 cursor-pointer transition-colors group"
          onClick={() => setShowCreateWizard(true)}
        >
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="font-display flex items-center gap-2">
                  Create a League
                  <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </CardTitle>
                <CardDescription>Start a new league with Classic Zrizin already loaded</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card
          className="border-secondary/30 hover:border-secondary/60 cursor-pointer transition-colors group"
          onClick={() => setShowJoinDialog(true)}
        >
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center group-hover:bg-secondary/30 transition-colors">
                <Users className="w-6 h-6 text-secondary" />
              </div>
              <div className="flex-1">
                <CardTitle className="font-display flex items-center gap-2">
                  {invitedCode ? 'Open My Invitation' : 'Join a League'}
                  <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </CardTitle>
                <CardDescription>{invitedCode ? 'Your invite code is already filled in' : 'Enter an invite code to join'}</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </motion.div>

      <JoinLeagueDialog
        open={showJoinDialog}
        onOpenChange={setShowJoinDialog}
        initialCode={invitedCode}
      />
    </div>
  );
}