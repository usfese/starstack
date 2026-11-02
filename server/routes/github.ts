import { Hono } from 'hono';
import type { GithubReposResponse } from '../../shared/types';
import { db } from '../db/index';
import { decryptToken } from '../lib/crypto';
import {
  fetchEligibleRepos,
  githubErrorMessage,
  GitHubError,
} from '../lib/github';
import { requireUser, type AppEnv } from '../middleware/auth';
import { ApiError } from '../middleware/errors';
import { enforceRateLimit } from '../middleware/rate-limit';

export const githubRoutes = new Hono<AppEnv>();

githubRoutes.get('/repos', async (c) => {
  const user = await requireUser(c);
  enforceRateLimit(user.id, 'github:repos', 30, 60 * 60 * 1000);

  if (!user.access_token_enc) {
    throw new ApiError(401, 'GITHUB_AUTH', 'GitHub 授权已失效，请重新登录');
  }

  let token: string;
  try {
    token = decryptToken(user.access_token_enc);
  } catch {
    throw new ApiError(401, 'GITHUB_AUTH', 'GitHub 授权已失效，请重新登录');
  }

  let repos;
  try {
    repos = await fetchEligibleRepos(token, user.login);
  } catch (error) {
    if (error instanceof GitHubError && error.status === 401) {
      throw new ApiError(401, 'GITHUB_AUTH', 'GitHub 授权已失效，请重新登录');
    }
    throw new ApiError(502, 'GITHUB_ERROR', githubErrorMessage(error));
  }

  const submittedRows = db
    .query('SELECT repo_full_name AS fullName FROM projects')
    .all() as { fullName: string }[];
  const submitted = new Set(submittedRows.map((row) => row.fullName.toLowerCase()));

  const payload: GithubReposResponse = {
    repos: repos.filter((repo) => !submitted.has(repo.fullName.toLowerCase())),
  };
  return c.json(payload);
});
