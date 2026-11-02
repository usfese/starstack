import { useEffect, useRef, useState } from 'react';
import { tagLabel } from '../../shared/constants';
import type { ProjectDetail } from '../../shared/types';
import { useToast } from '../context/ToastContext';

const WIDTH = 1200;
const HEIGHT = 1600;
const PAD = 72;
const FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';

const DIMENSION_LABELS = ['创新性', '工程质量', '文档', '可维护性', '实用价值'];

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
): void {
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const chars = [...text.replace(/\s+/g, ' ').trim()];
  const lines: string[] = [];
  let current = '';

  for (const char of chars) {
    const test = current + char;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = char;
      if (lines.length >= maxLines) break;
    } else {
      current = test;
    }
  }

  if (lines.length < maxLines && current) lines.push(current);
  const consumed = lines.join('').length;
  if (consumed < text.replace(/\s+/g, ' ').trim().length && lines.length > 0) {
    const lastIndex = lines.length - 1;
    lines[lastIndex] = fitText(ctx, lines[lastIndex]!, maxWidth);
  }
  return lines;
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  fill: string,
): void {
  ctx.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawStatCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
): void {
  fillRoundRect(ctx, x, y, width, height, 14, 'rgba(255,255,255,0.04)');
  roundRectPath(ctx, x, y, width, height, 14);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#94a3b8';
  ctx.font = `400 19px ${FONT}`;
  ctx.fillText(label, x + 18, y + 30);

  ctx.fillStyle = '#f8fafc';
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(fitText(ctx, value, width - 36), x + 18, y + 66);
}

function drawRadar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  values: number[],
): void {
  const count = values.length;
  const angle = (index: number) => -Math.PI / 2 + (index * Math.PI * 2) / count;
  const point = (index: number, scale: number) => ({
    x: cx + Math.cos(angle(index)) * radius * scale,
    y: cy + Math.sin(angle(index)) * radius * scale,
  });

  for (let ring = 1; ring <= 4; ring += 1) {
    ctx.beginPath();
    for (let index = 0; index < count; index += 1) {
      const p = point(index, ring / 4);
      if (index === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  for (let index = 0; index < count; index += 1) {
    const p = point(index, 1);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.beginPath();
  for (let index = 0; index < count; index += 1) {
    const value = Math.min(100, Math.max(0, values[index] ?? 0));
    const p = point(index, value / 100);
    if (index === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(99,102,241,0.32)';
  ctx.fill();
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  for (let index = 0; index < count; index += 1) {
    const value = Math.min(100, Math.max(0, values[index] ?? 0));
    const p = point(index, value / 100);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#c7d2fe';
    ctx.fill();
  }

  ctx.textAlign = 'center';
  for (let index = 0; index < count; index += 1) {
    const a = angle(index);
    const labelRadius = radius + 34;
    const x = cx + Math.cos(a) * labelRadius;
    const y = cy + Math.sin(a) * labelRadius;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `500 19px ${FONT}`;
    ctx.fillText(`${DIMENSION_LABELS[index]} ${values[index] ?? 0}`, x, y);
  }
  ctx.textAlign = 'left';
}

function drawPoster(canvas: HTMLCanvasElement, project: ProjectDetail, url: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, '#080c13');
  background.addColorStop(0.55, '#0c1422');
  background.addColorStop(1, '#080c13');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(940, 220, 0, 940, 220, 720);
  glow.addColorStop(0, 'rgba(99,102,241,0.26)');
  glow.addColorStop(1, 'rgba(99,102,241,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (let index = 0; index < 80; index += 1) {
    const x = (index * 167 + 37) % WIDTH;
    const y = (index * 283 + 61) % HEIGHT;
    ctx.fillStyle = `rgba(148,163,184,${0.05 + (index % 4) * 0.02})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // 边框
  roundRectPath(ctx, 24, 24, WIDTH - 48, HEIGHT - 48, 28);
  ctx.strokeStyle = 'rgba(129,140,248,0.42)';
  ctx.lineWidth = 2;
  ctx.stroke();
  roundRectPath(ctx, 32, 32, WIDTH - 64, HEIGHT - 64, 22);
  ctx.strokeStyle = 'rgba(34,211,238,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const topBar = ctx.createLinearGradient(72, 0, WIDTH - 72, 0);
  topBar.addColorStop(0, '#6366f1');
  topBar.addColorStop(0.5, '#22d3ee');
  topBar.addColorStop(1, '#f59e0b');
  ctx.fillStyle = topBar;
  ctx.fillRect(72, 0, WIDTH - 144, 5);

  // 页眉
  drawStar(ctx, PAD + 16, 92, 19, 8, '#fbbf24');
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8fafc';
  ctx.font = `700 32px ${FONT}`;
  ctx.fillText('星栈 StarStack', PAD + 46, 103);
  ctx.fillStyle = '#94a3b8';
  ctx.font = `500 18px ${FONT}`;
  ctx.fillText('让好项目被看见', PAD + 46, 132);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = `600 17px ${FONT}`;
  ctx.fillText('OPEN SOURCE · BUPT', WIDTH - PAD, 100);
  ctx.textAlign = 'left';

  // 项目标题
  ctx.font = `700 62px ${FONT}`;
  const titleLines = wrapText(ctx, project.title, WIDTH - PAD * 2, 2);
  const titleBaseline = 218;
  titleLines.forEach((line, index) => {
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(line, PAD, titleBaseline + index * 76);
  });

  const repoY = titleBaseline + titleLines.length * 76 + 16;
  ctx.fillStyle = '#94a3b8';
  ctx.font = `400 25px ${FONT}`;
  ctx.fillText(
    fitText(
      ctx,
      `github.com/${project.repoFullName} · by @${project.owner.login}`,
      WIDTH - PAD * 2,
    ),
    PAD,
    repoY,
  );

  // 标签
  let tagX = PAD;
  const tagY = repoY + 24;
  ctx.font = `500 19px ${FONT}`;
  for (const tag of project.tags.slice(0, 3)) {
    const label = `#${tagLabel(tag)}`;
    const width = ctx.measureText(label).width + 26;
    if (tagX + width > WIDTH - PAD) break;
    fillRoundRect(ctx, tagX, tagY, width, 36, 18, 'rgba(99,102,241,0.14)');
    roundRectPath(ctx, tagX, tagY, width, 36, 18);
    ctx.strokeStyle = 'rgba(129,140,248,0.30)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#c7d2fe';
    ctx.fillText(label, tagX + 13, tagY + 25);
    tagX += width + 10;
  }

  // 数据卡
  const statsY = project.tags.length > 0 ? tagY + 54 : repoY + 44;
  const gap = 14;
  const statWidth = (WIDTH - PAD * 2 - gap * 3) / 4;
  const stats = [
    { label: '本站 Star', value: String(project.stars.siteTotal) },
    { label: '本周 Star', value: String(project.stars.siteWeek) },
    { label: 'GitHub Star', value: String(project.stars.github) },
    { label: '语言', value: project.meta.language ?? '—' },
  ];
  stats.forEach((stat, index) => {
    drawStatCard(
      ctx,
      PAD + index * (statWidth + gap),
      statsY,
      statWidth,
      88,
      stat.label,
      stat.value,
    );
  });

  // AI 卡片
  const aiY = 620;
  const aiHeight = 570;
  fillRoundRect(ctx, PAD, aiY, WIDTH - PAD * 2, aiHeight, 24, 'rgba(255,255,255,0.035)');
  roundRectPath(ctx, PAD, aiY, WIDTH - PAD * 2, aiHeight, 24);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText('AI 质量评估', PAD + 38, aiY + 48);

  const score = project.score;
  if (score) {
    ctx.fillStyle = '#f8fafc';
    ctx.font = `700 108px ${FONT}`;
    const totalText = String(score.total);
    ctx.fillText(totalText, PAD + 38, aiY + 190);
    const totalWidth = ctx.measureText(totalText).width;
    ctx.fillStyle = '#64748b';
    ctx.font = `500 27px ${FONT}`;
    ctx.fillText('/100', PAD + 38 + totalWidth + 10, aiY + 190);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = `500 23px ${FONT}`;
    ctx.fillText('综合分', PAD + 40, aiY + 226);

    ctx.fillStyle = score.isHeuristic ? '#fbbf24' : '#818cf8';
    ctx.font = `500 18px ${FONT}`;
    ctx.fillText(
      fitText(ctx, score.isHeuristic ? '启发式评分' : score.model, 280),
      PAD + 40,
      aiY + 262,
    );

    drawRadar(ctx, 790, aiY + 270, 158, [
      score.dimensions.innovation,
      score.dimensions.engineering,
      score.dimensions.documentation,
      score.dimensions.maintainability,
      score.dimensions.usefulness,
    ]);
  } else {
    ctx.fillStyle = '#f8fafc';
    ctx.font = `700 96px ${FONT}`;
    ctx.fillText('—', PAD + 38, aiY + 185);
    ctx.fillStyle = '#94a3b8';
    ctx.font = `500 24px ${FONT}`;
    ctx.fillText(
      project.evaluationStatus === 'pending' || project.evaluationStatus === 'running'
        ? 'AI 评估中'
        : '暂无 AI 评分',
      PAD + 42,
      aiY + 232,
    );
    drawRadar(ctx, 790, aiY + 270, 158, [0, 0, 0, 0, 0]);
  }

  // AI 结论
  ctx.fillStyle = '#818cf8';
  ctx.font = `600 21px ${FONT}`;
  ctx.fillText('AI 结论', PAD, aiY + aiHeight + 38);

  ctx.font = `400 25px ${FONT}`;
  const summary = score?.summary || 'AI 评估完成后会显示简练结论。';
  const summaryLines = wrapText(ctx, summary, WIDTH - PAD * 2, 3);
  summaryLines.forEach((line, index) => {
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(line, PAD, aiY + aiHeight + 76 + index * 36);
  });

  // 优点 / 改进建议
  if (score) {
    const prosY = aiY + aiHeight + 190;
    const columnWidth = (WIDTH - PAD * 2 - 30) / 2;
    const columns = [
      { title: '优点', items: score.strengths.slice(0, 2), color: '#34d399' },
      { title: '改进建议', items: score.improvements.slice(0, 2), color: '#fbbf24' },
    ];
    columns.forEach((column, columnIndex) => {
      const x = PAD + columnIndex * (columnWidth + 30);
      ctx.fillStyle = column.color;
      ctx.font = `600 20px ${FONT}`;
      ctx.fillText(column.title, x, prosY);
      ctx.font = `400 20px ${FONT}`;
      column.items.forEach((item, itemIndex) => {
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(
          fitText(ctx, `· ${item}`, columnWidth),
          x,
          prosY + 30 + itemIndex * 28,
        );
      });
    });
  }

  // 页脚
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, 1490);
  ctx.lineTo(WIDTH - PAD, 1490);
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(fitText(ctx, url.replace(/^https?:\/\//, ''), 700), PAD, 1532);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = `400 19px ${FONT}`;
  ctx.fillText('星栈 StarStack · 开源项目分享', WIDTH - PAD, 1532);
  ctx.textAlign = 'left';
}

interface ShareProjectProps {
  project: ProjectDetail;
  open: boolean;
  onClose: () => void;
}

export function ShareProject({ project, open, onClose }: ShareProjectProps) {
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [url] = useState(() => `${window.location.origin}/projects/${project.id}`);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (canvas) drawPoster(canvas, project, url);
  }, [open, project, url]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error('生成图片失败');
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `starstack-${project.repoFullName.replace('/', '-')}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast.success('分享图已下载');
    }, 'image/png');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('项目链接已复制');
    } catch {
      toast.error('复制失败，请手动复制地址栏链接');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="分享项目"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d131b] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-white">分享项目</h2>
            <p className="mt-0.5 text-xs text-slate-500">包含项目数据、AI 评价和五维评分图</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭分享框"
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-sm text-slate-300 hover:bg-white/10"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            aria-label="项目分享图片预览"
            className="mx-auto h-auto w-full max-w-[520px] rounded-xl border border-white/10"
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
          <button
            type="button"
            onClick={() => void copyLink()}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            复制链接
          </button>
          <button
            type="button"
            onClick={download}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            下载图片
          </button>
        </div>
      </div>
    </div>
  );
}
