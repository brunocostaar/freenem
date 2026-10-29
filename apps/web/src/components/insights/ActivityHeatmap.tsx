import { useEffect, useMemo, useRef } from 'react';
import type { DailyActivity } from '@freenem/shared';
import { cn } from '@/lib/cn';

const WEEKS = 26;
const LEVELS = [
  'bg-surface-2',
  'bg-primary/25',
  'bg-primary/50',
  'bg-primary/75',
  'bg-primary',
] as const;

const key = (d: Date) => d.toLocaleDateString('en-CA');

function level(total: number) {
  if (total <= 0) return 0;
  if (total < 5) return 1;
  if (total < 10) return 2;
  if (total < 20) return 3;
  return 4;
}

interface Cell {
  date: string;
  label: string;
  total: number;
  correct: number;
}

/** Calendário de atividade estilo GitHub (últimos ~6 meses, colunas = semanas). */
export function ActivityHeatmap({ activity }: { activity: DailyActivity[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const { columns, months, totalDays, totalAnswers } = useMemo(() => {
    const byDate = new Map(activity.map((a) => [a.date, a]));
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - today.getDay() - (WEEKS - 1) * 7);
    const cols: (Cell | null)[][] = [];
    const monthLabels: string[] = [];
    let lastMonth = -1;
    for (let w = 0; w < WEEKS; w++) {
      const col: (Cell | null)[] = [];
      let label = '';
      for (let d = 0; d < 7; d++) {
        const day = new Date(start);
        day.setDate(start.getDate() + w * 7 + d);
        if (day > today) {
          col.push(null);
          continue;
        }
        if (d === 0 && day.getMonth() !== lastMonth) {
          lastMonth = day.getMonth();
          label = day.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        }
        const k = key(day);
        const a = byDate.get(k);
        col.push({
          date: k,
          label: day.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }),
          total: a?.total ?? 0,
          correct: a?.correct ?? 0,
        });
      }
      cols.push(col);
      monthLabels.push(label);
    }
    return {
      columns: cols,
      months: monthLabels,
      totalDays: activity.length,
      totalAnswers: activity.reduce((s, a) => s + a.total, 0),
    };
  }, [activity]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [columns]);

  return (
    <div>
      <p className="sr-only">
        {totalAnswers} questões respondidas em {totalDays} dias nos últimos seis meses.
      </p>
      <div ref={scroller} className="overflow-x-auto pb-2">
        <ul
          aria-label="Calendário de atividade: cada quadrado é um dia"
          className="inline-grid w-max gap-[3px]"
          style={{ gridAutoFlow: 'column', gridTemplateRows: 'auto repeat(7, 0.9rem)' }}
        >
          {columns.flatMap((col, w) => [
            <li
              key={`m${w}`}
              aria-hidden
              className="h-4 w-[0.9rem] overflow-visible text-[0.65rem] leading-none whitespace-nowrap text-muted"
            >
              {months[w]}
            </li>,
            ...col.map((cell, d) =>
              cell ? (
                <li
                  key={cell.date}
                  title={
                    cell.total
                      ? `${cell.label}: ${cell.total} questões, ${Math.round((cell.correct / cell.total) * 100)}% de acerto`
                      : `${cell.label}: sem atividade`
                  }
                  aria-label={
                    cell.total
                      ? `${cell.label}: ${cell.total} questões, ${cell.correct} corretas`
                      : `${cell.label}: sem atividade`
                  }
                  className={cn(
                    'size-[0.9rem] rounded-[3px] border border-line-soft',
                    LEVELS[level(cell.total)],
                  )}
                />
              ) : (
                <li key={`e${w}-${d}`} aria-hidden className="size-[0.9rem]" />
              ),
            ),
          ])}
        </ul>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-xs text-muted" aria-hidden>
        menos
        {LEVELS.map((l) => (
          <span key={l} className={cn('size-3 rounded-[3px] border border-line-soft', l)} />
        ))}
        mais
      </div>
    </div>
  );
}
