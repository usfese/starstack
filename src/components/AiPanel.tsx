import { useEffect, useRef } from 'react';
import type { Dimensions, EvalSummary, ProjectDetail } from '../../shared/types';
import { relativeTime, scoreBarClass, scoreColorClass } from '../lib/format';

const DIMENSION_LABELS: { key: keyof Dimensions; label: string }[] = [
  { key: 'innovation', label: '创新性' },
  { key: 'engineering', label: '工程质量' },
  { key: 'documentation', label: '文档' },
  { key: 'maintainability', label: '可维护性' },
  { key: 'usefulness', label: '实用价值' },
];

export function AiPanel({
  score,
  status,
  onRefresh,
}: {
  score: EvalSummary | null;
  status: ProjectDetail['evaluationStatus'];
  onRefresh: () => void;
}) {
  const polls = useRef(0);

  useEffect(() => {
    if (status !== 'pending' && status !== 'running') return undefined;
    polls.current = 0;
    const timer = window.setInterval(() => {
      polls.current += 1;
      if (polls.current > 20) {
        window.clearInterval(timer);
        return;
      }
      onRefresh();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [status, onRefresh]);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-base font-semibold text-white">AI 质量评估</h2>

      {!score && (status === 'pending' || status === 'running') ? (
        <p className="mt-4 text-sm text-slate-400">评估中…</p>
      ) : null}

      {!score && status === 'failed' ? (
        <p className="mt-4 text-sm text-rose-300">评估失败</p>
      ) : null}

      {!score && !status ? <p className="mt-4 text-sm text-slate-400">尚未评估</p> : null}

      {score ? (
        <div className="mt-3 flex flex-col gap-4">
          {status === 'pending' || status === 'running' ? (
            <p className="text-xs text-amber-300/90">正在重新评估，以下为上一次结果</p>
          ) : null}
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold ${scoreColorClass(score.total)}`}>
              {score.total}
            </span>
            <span className="text-xs text-slate-400">/ 100 综合分</span>
          </div>

          <div className="flex flex-col gap-2">
            {DIMENSION_LABELS.map(({ key, label }) => {
              const value = score.dimensions[key];
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-xs text-slate-400">{label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span
                      className={`block h-full rounded-full ${scoreBarClass(value)}`}
                      style={{ width: `${value}%` }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right text-xs text-slate-300">{value}</span>
                </div>
              );
            })}
          </div>

          <div>
            <h3 className="text-xs font-medium tracking-wide text-slate-400">优点</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-300">
              {score.strengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-medium tracking-wide text-slate-400">改进建议</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-300">
              {score.improvements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          {score.summary ? <p className="text-sm text-slate-400">{score.summary}</p> : null}

          {score.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {score.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <p className="border-t border-white/5 pt-3 text-xs text-slate-500">
            由 {score.model} 评估 · {relativeTime(score.createdAt)}
            {score.isHeuristic ? (
              <span className="mt-1 block text-amber-300/90">启发式评分（未配置 AI_API_KEY）</span>
            ) : null}
          </p>
        </div>
      ) : null}
    </section>
  );
}
