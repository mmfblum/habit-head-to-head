import { motion } from 'framer-motion';
import { LeaderboardRow } from '@/components/LeaderboardRow';
import { leagueMembers, currentLeague, currentUser, weeklyRecap } from '@/lib/mockData';
import { Trophy, Share2, Settings, Skull, Crown, Swords } from 'lucide-react';

export default function League() {
  const sortedMembers = [...leagueMembers].sort((a, b) => b.seasonScore - a.seasonScore);
  const lowestScorer = sortedMembers[sortedMembers.length - 1];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Season {currentLeague.season} • Week {currentLeague.week}</p>
              <h1 className="font-display font-bold text-xl">{currentLeague.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <Share2 className="w-4 h-4 text-muted-foreground" />
              </button>
              <button className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <Settings className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          
          {/* League Code */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Invite Code:</span>
            <code className="px-2 py-1 bg-muted rounded text-xs font-mono">{currentLeague.code}</code>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
        {/* Weekly Recap Card */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--gradient-hero)' }}
        >
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Swords className="w-4 h-4 text-white/80" />
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                Week {currentLeague.week - 1} Recap
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {/* Top Scorer */}
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                <Crown className="w-5 h-5 text-pending mx-auto mb-1" />
                <p className="text-2xl mb-1">{weeklyRecap.topScorer.avatar}</p>
                <p className="text-xs font-semibold text-white truncate">{weeklyRecap.topScorer.username}</p>
                <p className="text-[10px] text-white/70">Top Scorer</p>
              </div>
              
              {/* Biggest Win */}
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                <Trophy className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold text-white">+{weeklyRecap.biggestWin.margin}</p>
                <p className="text-xs text-white/80">{weeklyRecap.biggestWin.winner.username}</p>
                <p className="text-[10px] text-white/70">Biggest Win</p>
              </div>
              
              {/* Lowest Scorer */}
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                <Skull className="w-5 h-5 text-loss mx-auto mb-1" />
                <p className="text-2xl mb-1">{weeklyRecap.lowestScorer.avatar}</p>
                <p className="text-xs font-semibold text-white truncate">{weeklyRecap.lowestScorer.username}</p>
                <p className="text-[10px] text-white/70">{weeklyRecap.punishment}</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Leaderboard */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-pending" />
            <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Season Standings
            </h2>
          </div>
          
          <div className="space-y-2">
            {sortedMembers.map((member, index) => (
              <LeaderboardRow
                key={member.id}
                user={member}
                index={index}
                isCurrentUser={member.id === currentUser.id}
                isLowestScorer={member.id === lowestScorer.id}
              />
            ))}
          </div>
        </section>

        {/* Season Progress */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="card-elevated rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">Season Progress</span>
            <span className="text-xs text-muted-foreground">Week {currentLeague.week} of 8</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-2 rounded-full ${
                  i < currentLeague.week 
                    ? 'bg-primary' 
                    : i === currentLeague.week 
                    ? 'bg-primary/50 animate-pulse' 
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            3 weeks remaining • Top 3 advance to playoffs
          </p>
        </motion.section>
      </main>
    </div>
  );
}
