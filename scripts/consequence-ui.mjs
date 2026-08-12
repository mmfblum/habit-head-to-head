import fs from 'node:fs';

function replaceOnce(text, oldValue, newValue, label) {
  if (!text.includes(oldValue)) throw new Error(`Missing patch target: ${label}`);
  return text.replace(oldValue, newValue);
}

let text = fs.readFileSync('src/pages/League.tsx', 'utf8');
text = replaceOnce(
  text,
  "import { AccountabilityShareCard } from '@/components/solo/AccountabilityShareCard';\n",
  "import { AccountabilityShareCard } from '@/components/solo/AccountabilityShareCard';\nimport { PunishmentSettingsCard } from '@/components/league/PunishmentSettingsCard';\nimport { LeaderboardConsequenceCard } from '@/components/leaderboard/LeaderboardConsequenceCard';\n",
  'consequence imports',
);
text = replaceOnce(
  text,
  "        {isSolo && <AccountabilityShareCard leagueId={league.id} />}\n",
  "        {isSolo && <AccountabilityShareCard leagueId={league.id} />}\n        {!isSolo && <PunishmentSettingsCard leagueId={league.id} isAdmin={!!isAdmin} />}\n",
  'punishment settings card',
);
text = replaceOnce(
  text,
  "        {isActive && isLeaderboard && currentWeek && (\n          <section>",
  "        {isActive && isLeaderboard && currentWeek && (\n          <section>",
  'leaderboard section anchor',
);
const afterLeaderboard = `        {isActive && isHeadToHead && currentWeek && weekMatchups.length > 0 && (`;
const consequence = `        {isActive && isLeaderboard && currentWeek && (
          <LeaderboardConsequenceCard
            weekId={currentWeek.id}
            isLocked={currentWeek.is_locked}
            members={league.members}
            currentUserId={user?.id}
          />
        )}

`;
text = replaceOnce(text, afterLeaderboard, consequence + afterLeaderboard, 'leaderboard consequence');
fs.writeFileSync('src/pages/League.tsx', text);
