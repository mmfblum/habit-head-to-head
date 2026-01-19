// Mock data for the Fantasy Productivity app

export interface User {
  id: string;
  username: string;
  avatar: string;
  weeklyScore: number;
  seasonScore: number;
  wins: number;
  losses: number;
  streak: number;
  rank: number;
}

export interface Task {
  id: string;
  name: string;
  icon: string;
  description: string;
  type: 'steps' | 'workout' | 'reading' | 'sleep' | 'journal' | 'custom';
  target: number;
  unit: string;
  pointsPerUnit: number;
  maxPoints: number;
  currentValue: number;
  completed: boolean;
  streakDays: number;
}

export interface Matchup {
  id: string;
  week: number;
  user: User;
  opponent: User;
  userScore: number;
  opponentScore: number;
  status: 'in_progress' | 'completed' | 'upcoming';
}

export interface League {
  id: string;
  name: string;
  code: string;
  season: number;
  week: number;
  members: User[];
}

export const currentUser: User = {
  id: '1',
  username: 'You',
  avatar: '🏆',
  weeklyScore: 847,
  seasonScore: 3420,
  wins: 4,
  losses: 1,
  streak: 3,
  rank: 2,
};

export const opponent: User = {
  id: '2',
  username: 'Alex K.',
  avatar: '⚡',
  weeklyScore: 792,
  seasonScore: 3180,
  wins: 3,
  losses: 2,
  streak: 1,
  rank: 4,
};

export const leagueMembers: User[] = [
  { id: '3', username: 'Sarah M.', avatar: '🔥', weeklyScore: 923, seasonScore: 3650, wins: 5, losses: 0, streak: 5, rank: 1 },
  currentUser,
  { id: '4', username: 'Jordan T.', avatar: '💪', weeklyScore: 815, seasonScore: 3290, wins: 3, losses: 2, streak: 2, rank: 3 },
  opponent,
  { id: '5', username: 'Casey R.', avatar: '🌟', weeklyScore: 678, seasonScore: 2890, wins: 2, losses: 3, streak: 0, rank: 5 },
  { id: '6', username: 'Morgan L.', avatar: '😅', weeklyScore: 423, seasonScore: 2340, wins: 1, losses: 4, streak: 0, rank: 6 },
];

export const currentMatchup: Matchup = {
  id: 'm1',
  week: 5,
  user: currentUser,
  opponent: opponent,
  userScore: 847,
  opponentScore: 792,
  status: 'in_progress',
};

export const tasks: Task[] = [
  {
    id: 't1',
    name: 'Steps',
    icon: '👟',
    description: 'Walk 10,000 steps',
    type: 'steps',
    target: 10000,
    unit: 'steps',
    pointsPerUnit: 0.01,
    maxPoints: 100,
    currentValue: 8420,
    completed: false,
    streakDays: 7,
  },
  {
    id: 't2',
    name: 'Workout',
    icon: '💪',
    description: 'Complete a workout',
    type: 'workout',
    target: 1,
    unit: 'session',
    pointsPerUnit: 50,
    maxPoints: 50,
    currentValue: 1,
    completed: true,
    streakDays: 3,
  },
  {
    id: 't3',
    name: 'Reading',
    icon: '📚',
    description: 'Read for 30 minutes',
    type: 'reading',
    target: 30,
    unit: 'min',
    pointsPerUnit: 1,
    maxPoints: 30,
    currentValue: 15,
    completed: false,
    streakDays: 12,
  },
  {
    id: 't4',
    name: 'Sleep',
    icon: '😴',
    description: 'Sleep before midnight',
    type: 'sleep',
    target: 1,
    unit: '',
    pointsPerUnit: 40,
    maxPoints: 40,
    currentValue: 1,
    completed: true,
    streakDays: 5,
  },
  {
    id: 't5',
    name: 'Journal',
    icon: '📝',
    description: 'Write a journal entry',
    type: 'journal',
    target: 1,
    unit: 'entry',
    pointsPerUnit: 25,
    maxPoints: 25,
    currentValue: 0,
    completed: false,
    streakDays: 0,
  },
  {
    id: 't6',
    name: 'Meditation',
    icon: '🧘',
    description: 'Meditate for 10 minutes',
    type: 'custom',
    target: 10,
    unit: 'min',
    pointsPerUnit: 2,
    maxPoints: 20,
    currentValue: 10,
    completed: true,
    streakDays: 4,
  },
];

export const currentLeague: League = {
  id: 'l1',
  name: 'Productivity Pros',
  code: 'PROD2024',
  season: 3,
  week: 5,
  members: leagueMembers,
};

export const weeklyRecap = {
  topScorer: leagueMembers[0],
  biggestWin: { winner: leagueMembers[0], loser: leagueMembers[5], margin: 500 },
  lowestScorer: leagueMembers[5],
  punishment: '🎩 Wear the Shame Hat',
};
