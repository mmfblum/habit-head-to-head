import fs from 'node:fs';

function replaceOnce(text, oldValue, newValue, label) {
  if (!text.includes(oldValue)) throw new Error(`Missing patch target: ${label}`);
  return text.replace(oldValue, newValue);
}

// League format type.
let text = fs.readFileSync('src/hooks/useLeagues.ts', 'utf8');
text = replaceOnce(text, "export type LeagueGameFormat = 'head_to_head' | 'leaderboard';", "export type LeagueGameFormat = 'head_to_head' | 'leaderboard' | 'solo';", 'LeagueGameFormat');
fs.writeFileSync('src/hooks/useLeagues.ts', text);

// Season toast copy.
text = fs.readFileSync('src/hooks/useSeasonActions.ts', 'utf8');
text = replaceOnce(
  text,
  `        description: gameFormat === 'leaderboard'\n          ? 'The leaderboard opens Sunday. Everyone starts the week at zero.'\n          : 'The head-to-head schedule is set. Week 1 kicks off Sunday.',`,
  `        description: gameFormat === 'solo'\n          ? 'Your Solo scorecard is live now. Start scoring today.'\n          : gameFormat === 'leaderboard'\n            ? 'The leaderboard opens Sunday. Everyone starts the week at zero.'\n            : 'The head-to-head schedule is set. Week 1 kicks off Sunday.',`,
  'solo season toast',
);
fs.writeFileSync('src/hooks/useSeasonActions.ts', text);

// Bottom navigation.
text = fs.readFileSync('src/components/BottomNav.tsx', 'utf8');
text = replaceOnce(text, "  const isLeaderboard = league?.game_format === 'leaderboard';\n  const navItems = baseNavItems.filter((item) => !item.headToHeadOnly || !isLeaderboard);", "  const isHeadToHead = league?.game_format === 'head_to_head';\n  const isSolo = league?.game_format === 'solo';\n  const navItems = baseNavItems.filter((item) => !item.headToHeadOnly || isHeadToHead);", 'bottom nav format');
text = replaceOnce(text, "              <span className=\"text-[10px] font-medium\">{item.label}</span>", "              <span className=\"text-[10px] font-medium\">{isSolo && item.path === '/league' ? 'Progress' : item.label}</span>", 'solo progress label');
fs.writeFileSync('src/components/BottomNav.tsx', text);

// Public accountability route and nav hiding.
text = fs.readFileSync('src/App.tsx', 'utf8');
text = replaceOnce(text, 'import CheckinDemo from "./pages/CheckinDemo";\n', 'import CheckinDemo from "./pages/CheckinDemo";\nimport Accountability from "./pages/Accountability";\n', 'Accountability import');
text = replaceOnce(text, "  if (league?.game_format === 'leaderboard') {", "  if (league?.game_format && league.game_format !== 'head_to_head') {", 'head-to-head route guard');
text = replaceOnce(text, "function AppRoutes() {\n  const { user } = useAuth();\n  ", "function AppRoutes() {\n  const { user } = useAuth();\n  const location = useLocation();\n  ", 'AppRoutes location');
text = replaceOnce(text, '        <Route path="/auth" element={<AuthRoute />} />\n', '        <Route path="/auth" element={<AuthRoute />} />\n        <Route path="/accountability/:token" element={<Accountability />} />\n', 'public accountability route');
text = replaceOnce(text, '      {user && <BottomNav />}', "      {user && !location.pathname.startsWith('/accountability/') && <BottomNav />}", 'hide nav on accountability');
fs.writeFileSync('src/App.tsx', text);

// Create league wizard: Solo as a first-class two-step format.
text = fs.readFileSync('src/components/league/CreateLeagueWizard.tsx', 'utf8');
text = replaceOnce(text, "import { Check, ChevronLeft, ChevronRight, Copy, Gamepad2, ListOrdered, Share2, Swords, Trophy, Users, Zap } from 'lucide-react';", "import { Check, ChevronLeft, ChevronRight, Copy, Gamepad2, ListOrdered, Share2, Swords, Trophy, UserRound, Users, Zap } from 'lucide-react';", 'solo icon');
text = replaceOnce(text, "import type { LeagueGameFormat } from '@/hooks/useLeagues';\n", "import type { LeagueGameFormat } from '@/hooks/useLeagues';\nimport { useStartSeason } from '@/hooks/useSeasonActions';\n", 'start season import');
text = replaceOnce(text, "  const configureTasks = useConfigureSeasonTasks();\n", "  const configureTasks = useConfigureSeasonTasks();\n  const startSeason = useStartSeason();\n", 'start season hook');
text = replaceOnce(
  text,
  `      await configureTasks.mutateAsync({\n        seasonId: createdSeason.id,\n        taskConfigs: taskConfigArray,\n      });\n\n      setStep('invite');\n      toast.success('Your game is set. Now bring in the competition.');`,
  `      await configureTasks.mutateAsync({\n        seasonId: createdSeason.id,\n        taskConfigs: taskConfigArray,\n      });\n\n      if (formData.gameFormat === 'solo') {\n        await startSeason.mutateAsync({ seasonId: createdSeason.id, gameFormat: 'solo' });\n        toast.success('Solo is live. Your goals are on the clock.');\n        onClose();\n        navigate('/tasks');\n        return;\n      }\n\n      setStep('invite');\n      toast.success('Your game is set. Now bring in the competition.');`,
  'solo immediate start',
);
text = replaceOnce(
  text,
  `    if (createdLeague?.invite_code && navigator.share) {\n      try {\n        await navigator.share({\n          title: \`Join ${'${'}formData.name} on Zrizin\`,\n          text: \`Use invite code: ${'${'}createdLeague.invite_code}\`,\n          url: window.location.origin,\n        });`,
  `    if (createdLeague?.invite_code && navigator.share) {\n      try {\n        const inviteUrl = \`${'${'}window.location.origin}/?join=${'${'}encodeURIComponent(createdLeague.invite_code)}\`;\n        await navigator.share({\n          title: \`Join ${'${'}formData.name} on Zrizin\`,\n          text: 'Tap the link to join my Zrizin league.',\n          url: inviteUrl,\n        });`,
  'deep invite share',
);
text = replaceOnce(
  text,
  `  const steps = [\n    { id: 'details', label: 'League', icon: Trophy },\n    { id: 'tasks', label: 'Game', icon: Gamepad2 },\n    { id: 'invite', label: 'Friends', icon: Users },\n  ];\n  const currentStepIndex = steps.findIndex((item) => item.id === step);\n  const isLeaderboard = formData.gameFormat === 'leaderboard';`,
  `  const isLeaderboard = formData.gameFormat === 'leaderboard';\n  const isSolo = formData.gameFormat === 'solo';\n  const steps = isSolo\n    ? [\n        { id: 'details', label: 'Solo', icon: UserRound },\n        { id: 'tasks', label: 'Goals', icon: Gamepad2 },\n      ]\n    : [\n        { id: 'details', label: 'League', icon: Trophy },\n        { id: 'tasks', label: 'Game', icon: Gamepad2 },\n        { id: 'invite', label: 'Friends', icon: Users },\n      ];\n  const currentStepIndex = steps.findIndex((item) => item.id === step);`,
  'solo wizard steps',
);
text = replaceOnce(text, '<p className="text-muted-foreground">Choose how your group competes, then build the daily scorecard.</p>', '<p className="text-muted-foreground">Choose a competition format or make it personal with Solo accountability.</p>', 'wizard intro copy');
text = replaceOnce(text, '<div className="grid gap-3 sm:grid-cols-2">', '<div className="grid gap-3 sm:grid-cols-3">', 'format grid');
const leaderboardButtonEnd = `                        <p className="font-display font-bold mt-3">Leaderboard</p>\n                        <p className="text-xs text-muted-foreground mt-1">Everyone plays the same scorecard. Score the most points and finish #1.</p>\n                      </button>`;
const soloButton = `${leaderboardButtonEnd}\n\n                      <button\n                        type="button"\n                        onClick={() => setFormData({ ...formData, gameFormat: 'solo' })}\n                        className={\`rounded-2xl border-2 p-4 text-left transition-all ${'${'}\n                          formData.gameFormat === 'solo'\n                            ? 'border-primary bg-primary/10 shadow-sm'\n                            : 'border-border bg-card hover:border-primary/40'\n                        }\`}\n                      >\n                        <div className="flex items-center justify-between gap-3">\n                          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">\n                            <UserRound className="w-5 h-5 text-primary" />\n                          </div>\n                          {formData.gameFormat === 'solo' && <Check className="w-5 h-5 text-primary" />}\n                        </div>\n                        <p className="font-display font-bold mt-3">Solo</p>\n                        <p className="text-xs text-muted-foreground mt-1">Track your goals for yourself and share a live accountability page with friends.</p>\n                      </button>`;
text = replaceOnce(text, leaderboardButtonEnd, soloButton, 'Solo format card');
text = replaceOnce(text, "<span className=\"text-xs opacity-70\">{weeks} {isLeaderboard ? 'scoring weeks' : 'matchups'}</span>", "<span className=\"text-xs opacity-70\">{weeks} {isSolo ? 'tracking weeks' : isLeaderboard ? 'scoring weeks' : 'matchups'}</span>", 'solo season units');
text = replaceOnce(text, "<p className=\"text-xs mt-2\">{isLeaderboard ? 'Climb the board' : 'Weekly total wins'}</p>", "<p className=\"text-xs mt-2\">{isSolo ? 'Keep the promise' : isLeaderboard ? 'Climb the board' : 'Weekly total wins'}</p>", 'solo scoring explanation');
text = replaceOnce(text, 'disabled={taskConfigs.size < 3 || configureTasks.isPending}>\n                    {configureTasks.isPending ? \'Saving game...\' : \'Use This Scorecard & Invite Friends\'}', "disabled={taskConfigs.size < 3 || configureTasks.isPending || startSeason.isPending}>\n                    {configureTasks.isPending || startSeason.isPending ? 'Saving game...' : isSolo ? 'Start Tracking Today' : 'Use This Scorecard & Invite Friends'}", 'solo submit button');
fs.writeFileSync('src/components/league/CreateLeagueWizard.tsx', text);

// Dashboard: Solo accountability and non-competitive snapshot.
text = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
text = replaceOnce(text, "import { LeaderboardRaceCard } from '@/components/leaderboard/LeaderboardRaceCard';\n", "import { LeaderboardRaceCard } from '@/components/leaderboard/LeaderboardRaceCard';\nimport { AccountabilityShareCard } from '@/components/solo/AccountabilityShareCard';\n", 'solo share import dashboard');
text = replaceOnce(text, "  const isLeaderboard = leagueDetails?.game_format === 'leaderboard';\n", "  const isLeaderboard = leagueDetails?.game_format === 'leaderboard';\n  const isSolo = leagueDetails?.game_format === 'solo';\n  const isHeadToHead = leagueDetails?.game_format === 'head_to_head';\n", 'dashboard format flags');
text = replaceOnce(text, "    isLeaderboard ? undefined : currentWeek?.id", "    isHeadToHead ? currentWeek?.id : undefined", 'dashboard matchup query');
text = replaceOnce(text, "  if (leagueLoading || (!isLeaderboard && matchupLoading)) return <DashboardSkeleton />;", "  if (leagueLoading || (isHeadToHead && matchupLoading)) return <DashboardSkeleton />;", 'dashboard loading');
text = replaceOnce(text, "          {isLeaderboard && currentWeek ? (", "          {isSolo ? (\n            <AccountabilityShareCard leagueId={leagueDetails.id} />\n          ) : isLeaderboard && currentWeek ? (", 'solo dashboard hero');
text = replaceOnce(text, '<button onClick={() => navigate(\'/league\')} className="text-xs text-primary font-medium">Standings</button>', '<button onClick={() => navigate(\'/league\')} className="text-xs text-primary font-medium">{isSolo ? \'Progress\' : \'Standings\'}</button>', 'solo snapshot link');
text = replaceOnce(
  text,
  `          {isLeaderboard ? (\n            <div className="grid grid-cols-2 gap-3">`,
  `          {isSolo ? (\n            <div className="grid grid-cols-2 gap-3">\n              <div className="card-elevated rounded-xl p-4">\n                <Target className="w-4 h-4 text-primary mb-2" />\n                <p className="score-text text-2xl">{completedCount}/{transformedTasks.length}</p>\n                <p className="text-xs text-muted-foreground mt-1">Goals hit today</p>\n              </div>\n              <div className="card-elevated rounded-xl p-4">\n                <Zap className="w-4 h-4 text-secondary mb-2" />\n                <p className="score-text text-2xl">{(currentMember?.weekly_points ?? 0).toLocaleString()}</p>\n                <p className="text-xs text-muted-foreground mt-1">Week points</p>\n              </div>\n              <div className="card-elevated rounded-xl p-4">\n                <CalendarDays className="w-4 h-4 text-muted-foreground mb-2" />\n                <p className="score-text text-2xl">{currentWeek?.week_number ?? 1}</p>\n                <p className="text-xs text-muted-foreground mt-1">Tracking week</p>\n              </div>\n              <div className="card-elevated rounded-xl p-4">\n                <Trophy className="w-4 h-4 text-pending mb-2" />\n                <p className="score-text text-2xl">{(currentMember?.total_points ?? 0).toLocaleString()}</p>\n                <p className="text-xs text-muted-foreground mt-1">Season points</p>\n              </div>\n            </div>\n          ) : isLeaderboard ? (\n            <div className="grid grid-cols-2 gap-3">`,
  'solo season snapshot',
);
text = replaceOnce(text, "        {!isLeaderboard && displayMatchup && scheduledMatchup?.status === 'in_progress' && currentWeek && (", "        {isHeadToHead && displayMatchup && scheduledMatchup?.status === 'in_progress' && currentWeek && (", 'solo no powerplay');
fs.writeFileSync('src/pages/Dashboard.tsx', text);

// League page: turn the single-member view into Progress, not fake standings.
text = fs.readFileSync('src/pages/League.tsx', 'utf8');
text = replaceOnce(text, "import { Button } from '@/components/ui/button';\n", "import { Button } from '@/components/ui/button';\nimport { AccountabilityShareCard } from '@/components/solo/AccountabilityShareCard';\n", 'solo share import league');
text = replaceOnce(text, "  const isLeaderboard = league?.game_format === 'leaderboard';\n", "  const isLeaderboard = league?.game_format === 'leaderboard';\n  const isSolo = league?.game_format === 'solo';\n  const isHeadToHead = league?.game_format === 'head_to_head';\n", 'league format flags');
text = replaceOnce(text, "    !isLeaderboard && league?.current_season?.status === 'active' ? currentWeek?.id : undefined", "    isHeadToHead && league?.current_season?.status === 'active' ? currentWeek?.id : undefined", 'league matchup query');
text = replaceOnce(text, "  const lowestScorer = !isLeaderboard && isLiveWeek && weeklySorted.length > 1", "  const lowestScorer = isHeadToHead && isLiveWeek && weeklySorted.length > 1", 'lowest scorer h2h only');
text = replaceOnce(text, "  const byeMember = !isLeaderboard && league.members.length > 1", "  const byeMember = isHeadToHead && league.members.length > 1", 'bye h2h only');
text = replaceOnce(
  text,
  `  const headerEyebrow = !currentSeason\n    ? 'No season'\n    : isDraft\n      ? \`Season ${'${'}currentSeason.season_number} • Preseason • ${'${'}isLeaderboard ? 'Leaderboard' : 'Head-to-Head'}\`\n      : isScheduledWeek && currentWeek\n        ? \`Season ${'${'}currentSeason.season_number} • Week ${'${'}currentWeek.week_number} starts ${'${'}formatWeekKickoff(currentWeek.start_date)}\`\n        : \`Season ${'${'}currentSeason.season_number}${'${'}currentWeek ? \` • Week ${'${'}currentWeek.week_number}\` : ''} • ${'${'}isLeaderboard ? 'Leaderboard' : 'Head-to-Head'}\`;`,
  `  const formatLabel = isSolo ? 'Solo' : isLeaderboard ? 'Leaderboard' : 'Head-to-Head';\n  const headerEyebrow = !currentSeason\n    ? 'No season'\n    : isDraft\n      ? \`Season ${'${'}currentSeason.season_number} • ${'${'}isSolo ? 'Setup' : 'Preseason'} • ${'${'}formatLabel}\`\n      : isScheduledWeek && currentWeek\n        ? \`Season ${'${'}currentSeason.season_number} • Week ${'${'}currentWeek.week_number} starts ${'${'}formatWeekKickoff(currentWeek.start_date)}\`\n        : \`Season ${'${'}currentSeason.season_number}${'${'}currentWeek ? \` • Week ${'${'}currentWeek.week_number}\` : ''} • ${'${'}formatLabel}\`;`,
  'league header format label',
);
text = replaceOnce(
  text,
  `              <button onClick={copyInviteCode} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center" aria-label="Share league code">\n                <Share2 className="w-4 h-4 text-muted-foreground" />\n              </button>`,
  `              {league.invite_code && (\n                <button onClick={copyInviteCode} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center" aria-label="Share league code">\n                  <Share2 className="w-4 h-4 text-muted-foreground" />\n                </button>\n              )}`,
  'hide solo invite header',
);
text = replaceOnce(text, '      <main className="px-4 py-4 space-y-6">\n', '      <main className="px-4 py-4 space-y-6">\n        {isSolo && <AccountabilityShareCard leagueId={league.id} />}\n', 'solo accountability league card');
text = replaceOnce(text, "                      {isLeaderboard ? 'Ready to open the leaderboard' : 'Ready to set the schedule'}", "                      {isSolo ? 'Ready to start tracking' : isLeaderboard ? 'Ready to open the leaderboard' : 'Ready to set the schedule'}", 'solo ready title');
text = replaceOnce(
  text,
  `                      {league.members.length < 2\n                        ? \`Your rules are set. Invite at least one ${'${'}isLeaderboard ? 'other player' : 'opponent'} before Week 1 can begin.\`\n                        : isLeaderboard\n                          ? \`${'${'}league.members.length} players are in. Starting now sets Week 1 for Sunday; everyone begins the weekly race at zero.\`\n                          : \`${'${'}league.members.length} players are in. Scheduling now locks the round-robin slate and sets Week 1 for the upcoming Sunday.\`}`,
  `                      {isSolo\n                        ? 'Your goals are set. Start now and Week 1 begins today.'\n                        : league.members.length < 2\n                          ? \`Your rules are set. Invite at least one ${'${'}isLeaderboard ? 'other player' : 'opponent'} before Week 1 can begin.\`\n                          : isLeaderboard\n                            ? \`${'${'}league.members.length} players are in. Starting now sets Week 1 for Sunday; everyone begins the weekly race at zero.\`\n                            : \`${'${'}league.members.length} players are in. Scheduling now locks the round-robin slate and sets Week 1 for the upcoming Sunday.\`}`,
  'solo draft explanation',
);
text = replaceOnce(text, "                      {league.members.length < 2 ? (", "                      {!isSolo && league.members.length < 2 ? (", 'solo start button gate');
text = replaceOnce(text, "                            : isLeaderboard ? 'Start Leaderboard' : 'Schedule Season 1'}", "                            : isSolo ? 'Start Solo Today' : isLeaderboard ? 'Start Leaderboard' : 'Schedule Season 1'}", 'solo start label');
text = replaceOnce(text, "        {isActive && !isLeaderboard && currentWeek && weekMatchups.length > 0 && (", "        {isActive && isHeadToHead && currentWeek && weekMatchups.length > 0 && (", 'matchup section h2h only');
text = replaceOnce(text, `        <section>\n          <div className="flex items-center gap-2 mb-3">\n            <Trophy className="w-4 h-4 text-pending" />`, `        {!isSolo && (\n        <section>\n          <div className="flex items-center gap-2 mb-3">\n            <Trophy className="w-4 h-4 text-pending" />`, 'hide solo standings start');
text = replaceOnce(text, `          )}\n        </section>\n\n        {isLiveWeek && currentSeason && currentWeek && (`, `          )}\n        </section>\n        )}\n\n        {isLiveWeek && currentSeason && currentWeek && (`, 'hide solo standings end');
fs.writeFileSync('src/pages/League.tsx', text);

// Leaderboard row can accept Solo if used elsewhere.
text = fs.readFileSync('src/components/LeaderboardRow.tsx', 'utf8');
text = replaceOnce(text, "  competitionFormat?: 'head_to_head' | 'leaderboard';", "  competitionFormat?: 'head_to_head' | 'leaderboard' | 'solo';", 'LeaderboardRow solo type');
fs.writeFileSync('src/components/LeaderboardRow.tsx', text);
