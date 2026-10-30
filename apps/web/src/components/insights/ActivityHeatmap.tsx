import { useEffect, useMemo, useRef, useState } from 'react';
import type { DailyActivity } from '@freenem/shared';
import { cn } from '@/lib/cn';

const MIN_WEEKS = 13;
const MAX_WEEKS = 53;
/** largura-alvo de cada coluna (célula + espaço), em px */
const COLUMN_PX = 18;
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

/**
 * Calendário de atividade estilo GitHub (colunas = semanas). Ocupa toda a largura do cartão:
 * o número de semanas se adapta à largura (de ~3 meses no celular até 1 ano no desktop).
 */
export function ActivityHeatmap({ activity }: { activity: DailyActivity[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [weeks, setWeeks] = useState(26);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () =>
      setWeeks(Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, Math.floor(el.clientWidth / COLUMN_PX))));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { columns, months, totalDays, totalAnswers } = useMemo(() => {
    const byDate = new Map(activity.map((a) => [a.date, a]));
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - today.getDay() - (weeks - 1) * 7);
    const cols: (Cell | null)[][] = [];
    const monthLabels: string[] = [];
    let lastMonth = -1;
    for (let w = 0; w < weeks; w++) {
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
  }, [activity, weeks]);

  return (
    <div>
      <p className="sr-only">
        {totalAnswers} questões respondidas em {totalDays} dias nas últimas {weeks} semanas.
      </p>
      <div ref={box} className="pb-2">
        <ul
          aria-label="Calendário de atividade: cada quadrado é um dia"
          className="grid w-full gap-[3px]"
          style={{
            gridAutoFlow: 'column',
            gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`,
            gridTemplateRows: 'auto repeat(7, auto)',
          }}
        >
          {columns.flatMap((col, w) => [
            <li
              key={`m${w}`}
              aria-hidden
              className="h-4 overflow-visible text-[0.65rem] leading-none whitespace-nowrap text-muted"
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
                    'aspect-square w-full rounded-[3px] border border-line-soft',
                    LEVELS[level(cell.total)],
                  )}
                />
              ) : (
                <li key={`e${w}-${d}`} aria-hidden className="aspect-square w-full" />
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
