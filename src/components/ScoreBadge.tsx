import type { EvalSummary } from '../../shared/types';
import { scoreColorClass } from '../lib/format';

export function ScoreBadge({ score }: { score: EvalSummary | null }) {
  if (!score) {
    return (
      <span className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-400">
        评估中
      </span>
    );
  }

  return (
    <span
      className={`shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold ${scoreColorClass(score.total)}`}
      title={score.isHeuristic ? '启发式评分' : `由 ${score.model} 评估`}
    >
      AI {score.total}
    </span>
  );
}
