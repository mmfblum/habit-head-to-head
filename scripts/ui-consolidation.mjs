import fs from 'node:fs';

function replaceOnce(text, oldValue, newValue, label) {
  if (!text.includes(oldValue)) throw new Error(`Missing patch target: ${label}`);
  return text.replace(oldValue, newValue);
}

let profile = fs.readFileSync('src/pages/Profile.tsx', 'utf8');
profile = replaceOnce(
  profile,
  "import { useDeleteLeague, useLeaveLeague } from '@/hooks/useLeagueActions';\n",
  "import { useDeleteLeague, useLeaveLeague } from '@/hooks/useLeagueActions';\nimport { TrophyCase } from '@/components/profile/TrophyCase';\n",
  'profile TrophyCase import',
);
profile = replaceOnce(
  profile,
  `        {
          icon: Target,
          label: 'Week Points',
          value: currentMember?.weekly_points?.toLocaleString() ?? '0',
          subtext: 'Current scoring week',
        },
        {
          icon: Award,
          label: 'Season Points',
          value: currentMember?.total_points?.toLocaleString() ?? '0',
          subtext: 'Cumulative total',
        },`,
  `        {
          icon: Target,
          label: 'Week Raw Points',
          value: currentMember?.weekly_points?.toLocaleString() ?? '0',
          subtext: 'Current weekly race',
        },
        {
          icon: Award,
          label: 'Championship Points',
          value: currentMember?.championship_points?.toLocaleString() ?? '0',
          subtext: \`${'${'}currentMember?.total_points?.toLocaleString() ?? '0'} raw season pts\`,
        },`,
  'leaderboard profile stat cards',
);
profile = replaceOnce(
  profile,
  `        <section className="card-elevated rounded-xl p-4">\n`,
  `        <TrophyCase
          userId={user?.id}
          seasonId={league?.current_season?.id}
          wins={currentMember?.wins ?? 0}
          currentStreak={currentMember?.current_streak ?? 0}
          streakType={currentMember?.streak_type}
        />

        <section className="card-elevated rounded-xl p-4">\n`,
  'profile trophy case placement',
);
fs.writeFileSync('src/pages/Profile.tsx', profile);

let league = fs.readFileSync('src/pages/League.tsx', 'utf8');
league = replaceOnce(
  league,
  '      return b.total_points - a.total_points || b.weekly_points - a.weekly_points;',
  '      return b.championship_points - a.championship_points || b.total_points - a.total_points || b.weekly_points - a.weekly_points;',
  'leaderboard season sort',
);
league = replaceOnce(
  league,
  `    if (member?.avatar_url) {
      return <img src={member.avatar_url} alt={member.display_name || 'Player'} className="w-full h-full object-cover" />;
    }
    return <span>{member?.display_name?.charAt(0).toUpperCase() || getDefaultAvatar(rank)}</span>;`,
  `    if (member?.avatar_url) {
      if (member.avatar_url.startsWith('http://') || member.avatar_url.startsWith('https://')) {
        return <img src={member.avatar_url} alt={member.display_name || 'Player'} className="w-full h-full object-cover" />;
      }
      return <span className="text-xl">{member.avatar_url}</span>;
    }
    return <span>{member?.display_name?.charAt(0).toUpperCase() || getDefaultAvatar(rank)}</span>;`,
  'league mascot rendering',
);
league = replaceOnce(
  league,
  '    seasonScore: member.total_points,',
  '    seasonScore: isLeaderboard ? member.championship_points : member.total_points,',
  'leaderboard championship score',
);
league = replaceOnce(
  league,
  "              {isActive ? 'Season Standings' : 'League Members'}",
  "              {isActive ? (isLeaderboard ? 'Season Championship' : 'Season Standings') : 'League Members'}",
  'leaderboard heading',
);
fs.writeFileSync('src/pages/League.tsx', league);
