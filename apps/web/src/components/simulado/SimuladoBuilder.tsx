import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  attemptSchema,
  simuladoSchema,
  type EnemArea,
  type SimuladoCreate,
  type SimuladoLanguage,
  type SimuladoOptions,
} from '@freenem/shared';
import { z } from 'zod';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { AREA_SHORT, formatMinutes, simuladoOptionsQuery } from '@/lib/simulados';
import { Button, Card, Select, Skeleton, useToast } from '@/components/ui';

type Tab = 'official' | 'custom';
type ExamOption = SimuladoOptions['exams'][number];

const AREAS: EnemArea[] = ['linguagens', 'humanas', 'natureza', 'matematica'];
const TIME_CHOICES = [30, 60, 90, 135, 180, 270];
/** ENEM por área: 45 questões, ~3 min por questão */
const AREA_PRESET = { count: 45, minutes: 135 };
const ENEM_DAY_QUESTIONS = 90;

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/** Mesma regra do servidor: tempo proporcional ao do dia do ENEM (330/300 min para 90 questões). */
function suggestedMinutes(exam: ExamOption, n: number): number {
  if (exam.officialMinutes === null) return Math.ceil(n * 3);
  return Math.max(
    1,
    Math.min(exam.officialMinutes, Math.round((exam.officialMinutes * n) / ENEM_DAY_QUESTIONS)),
  );
}

function examLabel(e: ExamOption) {
  return [e.label, e.color && !e.label.toLowerCase().includes(e.color.toLowerCase()) && e.color]
    .filter(Boolean)
    .join(' · ');
}

export function SimuladoBuilder({ onDone }: { onDone?: () => void }) {
  const { data, isPending, error } = useQuery(simuladoOptionsQuery);
  const [tab, setTab] = useState<Tab>('official');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const create = useMutation({
    mutationFn: async (body: SimuladoCreate) => {
      const simulado = await api('/api/v1/simulados', {
        method: 'POST',
        body,
        schema: simuladoSchema,
      });
      const { attempt } = await api(`/api/v1/simulados/${simulado.id}/attempts`, {
        method: 'POST',
        body: {},
        schema: z.object({ attempt: attemptSchema }),
      });
      return attempt;
    },
    onSuccess: (attempt) => {
      void qc.invalidateQueries({ queryKey: ['simulados'] });
      onDone?.();
      void navigate({ to: '/simulados/$attemptId/fazer', params: { attemptId: attempt.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Não foi possível criar.'),
  });

  if (isPending) return <Skeleton className="h-72 w-full" />;
  if (error || !data) {
    return <p className="text-danger">Não foi possível carregar as opções de simulado.</p>;
  }

  return (
    <Card>
      <div role="tablist" aria-label="Tipo de simulado" className="mb-5 flex gap-2">
        {(
          [
            ['official', 'Prova oficial'],
            ['custom', 'Personalizado'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
            className={cn(
              'rounded-xl border-2 border-line px-4 py-2 font-semibold transition-colors',
              tab === id
                ? 'bg-primary text-primary-ink shadow-hard-sm'
                : 'bg-surface hover:bg-surface-2',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'official' ? (
          <OfficialForm options={data} busy={create.isPending} onSubmit={(b) => create.mutate(b)} />
        ) : (
          <CustomForm options={data} busy={create.isPending} onSubmit={(b) => create.mutate(b)} />
        )}
      </div>
    </Card>
  );
}

function OfficialForm({
  options,
  busy,
  onSubmit,
}: {
  options: SimuladoOptions;
  busy: boolean;
  onSubmit: (b: SimuladoCreate) => void;
}) {
  const years = useMemo(() => [...new Set(options.exams.map((e) => e.year))], [options.exams]);
  const [year, setYear] = useState<number | null>(years[0] ?? null);
  const examsOfYear = useMemo(
    () => options.exams.filter((e) => e.year === year),
    [options.exams, year],
  );
  const [examId, setExamId] = useState<string>(examsOfYear[0]?.id ?? '');
  const [area, setArea] = useState<EnemArea | ''>('');
  const [noLimit, setNoLimit] = useState(false);
  const [language, setLanguage] = useState<SimuladoLanguage>('ingles');

  const exam = options.exams.find((e) => e.id === examId);
  // Provas com Inglês e Espanhol (números 1–5 repetidos): o aluno escolhe uma língua.
  const hasLanguageChoice = Boolean(
    exam && exam.languageCounts.ingles > 0 && exam.languageCounts.espanhol > 0,
  );
  const droppedLanguage: SimuladoLanguage = language === 'ingles' ? 'espanhol' : 'ingles';
  const languageDiscount = hasLanguageChoice && exam ? exam.languageCounts[droppedLanguage] : 0;
  const rawCount = exam
    ? area
      ? (exam.areas.find((a) => a.area === area)?.count ?? 0)
      : exam.questionCount
    : 0;
  // a língua só pesa na prova completa ou na área de Linguagens
  const count = rawCount - (area === '' || area === 'linguagens' ? languageDiscount : 0);

  if (options.exams.length === 0) {
    return (
      <p className="text-muted">
        Ainda não há provas com questões publicadas. Use a aba Personalizado ou volte mais tarde.
      </p>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!exam) return;
        onSubmit({
          mode: 'official',
          examId: exam.id,
          ...(area ? { area } : {}),
          ...(hasLanguageChoice ? { language } : {}),
          ...(noLimit ? { timeLimitMinutes: null } : {}),
        });
      }}
    >
      <div className={cn('grid gap-4', hasLanguageChoice ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
        <Select
          label="Ano"
          value={year ?? ''}
          onChange={(e) => {
            const y = Number(e.target.value);
            setYear(y);
            setExamId(options.exams.find((x) => x.year === y)?.id ?? '');
            setArea('');
          }}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
        <Select
          label="Prova / dia"
          value={examId}
          onChange={(e) => {
            setExamId(e.target.value);
            setArea('');
          }}
        >
          {examsOfYear.map((e) => (
            <option key={e.id} value={e.id}>
              {e.institution} - {examLabel(e)}
            </option>
          ))}
        </Select>
        <Select
          label="Área"
          value={area}
          onChange={(e) => setArea(e.target.value as EnemArea | '')}
        >
          <option value="">Prova completa</option>
          {exam?.areas.map((a) => (
            <option key={a.area} value={a.area}>
              {AREA_SHORT[a.area]} ({a.area === 'linguagens' ? a.count - languageDiscount : a.count}
              )
            </option>
          ))}
        </Select>
        {hasLanguageChoice && (
          <Select
            label="Língua estrangeira"
            value={language}
            onChange={(e) => setLanguage(e.target.value as SimuladoLanguage)}
          >
            <option value="ingles">Inglês</option>
            <option value="espanhol">Espanhol</option>
          </Select>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={noLimit}
          onChange={(e) => setNoLimit(e.target.checked)}
          className="size-4 accent-[var(--primary)]"
        />
        Sem limite de tempo
      </label>
      {exam && (
        <p className="text-sm text-muted" aria-live="polite">
          {count} {count === 1 ? 'questão' : 'questões'} ·{' '}
          {noLimit
            ? 'sem limite'
            : `tempo proporcional ao oficial: ${formatMinutes(suggestedMinutes(exam, count))}`}
        </p>
      )}
      <Button type="submit" loading={busy} disabled={!exam || count === 0}>
        Criar e começar
      </Button>
    </form>
  );
}

function CustomForm({
  options,
  busy,
  onSubmit,
}: {
  options: SimuladoOptions;
  busy: boolean;
  onSubmit: (b: SimuladoCreate) => void;
}) {
  const [areas, setAreas] = useState<EnemArea[]>([]);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [institutionIds, setInstitutionIds] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [count, setCount] = useState(20);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [excludeAnswered, setExcludeAnswered] = useState(false);

  const subjects = options.subjects.filter(
    (s) => s.questionCount > 0 && (areas.length === 0 || areas.includes(s.area)),
  );

  function applyPreset(area: EnemArea) {
    setAreas([area]);
    setSubjectIds([]);
    setCount(AREA_PRESET.count);
    setMinutes(AREA_PRESET.minutes);
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          mode: 'custom',
          questionCount: count,
          timeLimitMinutes: minutes,
          filters: {
            ...(areas.length ? { areas } : {}),
            ...(subjectIds.length ? { subjectIds } : {}),
            ...(institutionIds.length ? { institutionIds } : {}),
            ...(years.length ? { years } : {}),
            ...(excludeAnswered ? { excludeAnswered: true } : {}),
          },
        });
      }}
    >
      <Group label="Atalho: ENEM por área" hint="45 questões em 2 h 15 min">
        {AREAS.map((a) => (
          <Chip key={a} pressed={false} onClick={() => applyPreset(a)}>
            {AREA_SHORT[a]}
          </Chip>
        ))}
      </Group>
      <Group label="Áreas">
        {AREAS.map((a) => (
          <Chip
            key={a}
            pressed={areas.includes(a)}
            onClick={() => {
              setAreas(toggle(areas, a));
              setSubjectIds([]);
            }}
          >
            {AREA_SHORT[a]}
          </Chip>
        ))}
      </Group>
      {subjects.length > 0 && (
        <Group label="Matérias" hint="Vazio = todas">
          {subjects.map((s) => (
            <Chip
              key={s.id}
              pressed={subjectIds.includes(s.id)}
              onClick={() => setSubjectIds(toggle(subjectIds, s.id))}
            >
              {s.name} ({s.questionCount})
            </Chip>
          ))}
        </Group>
      )}
      {options.institutions.some((i) => i.questionCount > 0) && (
        <Group label="Instituições" hint="Vazio = todas">
          {options.institutions
            .filter((i) => i.questionCount > 0)
            .map((i) => (
              <Chip
                key={i.id}
                pressed={institutionIds.includes(i.id)}
                onClick={() => setInstitutionIds(toggle(institutionIds, i.id))}
              >
                {i.name}
              </Chip>
            ))}
        </Group>
      )}
      {options.years.length > 0 && (
        <Group label="Anos" hint="Vazio = todos">
          {options.years.map((y) => (
            <Chip key={y} pressed={years.includes(y)} onClick={() => setYears(toggle(years, y))}>
              {y}
            </Chip>
          ))}
        </Group>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sim-count" className="text-sm font-semibold">
            Quantidade de questões: <span className="tabular-nums">{count}</span>
          </label>
          <input
            id="sim-count"
            type="range"
            min={5}
            max={90}
            step={1}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="h-11 w-full accent-[var(--primary)]"
          />
        </div>
        <Select
          label="Tempo"
          value={minutes ?? ''}
          onChange={(e) => setMinutes(e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">Sem limite</option>
          {TIME_CHOICES.map((m) => (
            <option key={m} value={m}>
              {formatMinutes(m)}
            </option>
          ))}
        </Select>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={excludeAnswered}
          onChange={(e) => setExcludeAnswered(e.target.checked)}
          className="size-4 accent-[var(--primary)]"
        />
        Só questões que ainda não respondi
      </label>
      <Button type="submit" loading={busy}>
        Criar e começar
      </Button>
    </form>
  );
}

function Group({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">
        {label}
        {hint && <span className="ml-2 font-normal text-muted">{hint}</span>}
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'rounded-full border-2 border-line px-3 py-1 text-sm font-semibold transition-colors',
        pressed ? 'bg-primary text-primary-ink' : 'bg-surface hover:bg-surface-2',
      )}
    >
      {children}
    </button>
  );
}
