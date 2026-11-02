import { Hono } from 'hono';
import { getLeaderboard } from '../lib/leaderboard';

export const leaderboardRoutes = new Hono();

leaderboardRoutes.get('/', (c) => c.json(getLeaderboard()));
