export interface UserDTO {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  createdAt: string;
}

export interface Dimensions {
  innovation: number;
  engineering: number;
  documentation: number;
  maintainability: number;
  usefulness: number;
}

export interface EvalSummary {
  id: number;
  total: number;
  dimensions: Dimensions;
  isHeuristic: boolean;
  model: string;
  summary: string | null;
  strengths: string[];
  improvements: string[];
  tags: string[];
  createdAt: string;
}

export interface ProjectListItem {
  id: number;
  title: string;
  repoFullName: string;
  repoOwner: string;
  repoName: string;
  tags: string[];
  createdAt: string;
  status: 'published' | 'hidden';
  owner: { id: number; login: string; name: string | null; avatarUrl: string | null };
  score: EvalSummary | null;
  stars: { siteTotal: number; siteWeek: number; github: number };
  meta: {
    description: string | null;
    language: string | null;
    homepage: string | null;
    pushedAt: string | null;
    archived: boolean;
    forks: number;
  };
  viewer: { starred: boolean; isOwner: boolean };
}

export interface ProjectDetail extends ProjectListItem {
  introMd: string;
  demoUrl: string | null;
  repoMissing: boolean;
  evaluationStatus: 'pending' | 'running' | 'done' | 'failed' | null;
}

export interface LeaderboardEntry {
  rank: number;
  projectId: number;
  title: string;
  repoFullName: string;
  ownerLogin: string;
  weekStars: number;
  totalStars: number;
  aiScore: number | null;
  isHeuristic: boolean;
}

export interface MeResponse {
  user: UserDTO | null;
  stats?: { projects: number; starsGiven: number; starsReceived: number };
}

export interface WeekRange {
  key: string;
  start: string;
  end: string;
}

export interface LeaderboardResponse {
  week: WeekRange;
  entries: LeaderboardEntry[];
  history: { key: string; start: string; end: string; entries: LeaderboardEntry[] }[];
}

export interface ProjectListResponse {
  items: ProjectListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AiSettingsDTO {
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  sources: { baseUrl: 'db' | 'env'; apiKey: 'db' | 'env' | 'none'; model: 'db' | 'env' };
}

export interface ProjectPatchResponse {
  ok: boolean;
  evaluationQueued: boolean;
  nextEvaluationAt?: string;
}

export interface GithubRepoOption {
  fullName: string;
  name: string;
  ownerLogin: string;
  ownerType: 'User' | 'Organization';
  description: string | null;
  language: string | null;
  stars: number;
  fork: boolean;
  archived: boolean;
  private: boolean;
}

export interface GithubReposResponse {
  repos: GithubRepoOption[];
}
