import { useEffect, useId, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  DIFFICULTY_LABELS,
  type CatalogResponse,
  type Difficulty,
  type QuestionSearch,
} from '@freenem/shared';
import { Button, Input, Select } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface QuestionFiltersProps {
  value: QuestionSearch;
  onChange: (patch: Partial<QuestionSearch>) => void;
  onReset: () => void;
  catalog: CatalogResponse | undefined;
  loggedIn: boolean;
}

const DIFFICULTIES: (Difficulty | undefined)[] = [undefined, 'easy', 'medium', 'hard'];

export const hasActiveFilters = (v: QuestionSearch) =>
  Boolean(
    v.institutionId ||
    v.year ||
    v.subjectId ||
    v.topicId ||
    v.q ||
    v.difficulty ||
    v.onlyUnanswered ||
    v.onlyWrong ||
    v.onlySaved,
  );

export function QuestionFilters({
  value,
  onChange,
  onReset,
  catalog,
  loggedIn,
}: QuestionFiltersProps) {
  const [text, setText] = useState(value.q ?? '');

  // URL -> campo (ex.: botão voltar)
  useEffect(() => setText(value.q ?? ''), [value.q]);
  // campo -> URL (com debounce)
  useEffect(() => {
    const trimmed = text.trim();
    if (trimmed === (value.q ?? '')) return;
    const t = setTimeout(() => onChange({ q: trimmed.length >= 2 ? trimmed : undefined }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const years = value.institutionId
    ? (catalog?.institutionYears[value.institutionId] ?? [])
    : (catalog?.years ?? []);
  const subject = catalog?.subjects.find((s) => s.id === value.subjectId);

  return (
    <form
      role="search"
      aria-label="Filtros de questões"
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = text.trim();
        onChange({ q: trimmed.length >= 2 ? trimmed : undefined });
      }}
    >
      <div className="relative">
        <Input
          label="Buscar no enunciado"
          type="search"
          placeholder="ex.: efeito estufa"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="pr-10"
        />
        <Search
          className="pointer-events-none absolute right-3 bottom-3 size-5 text-muted"
          aria-hidden
        />
      </div>

      <Select
        label="Instituição"
        value={value.institutionId ?? ''}
        onChange={(e) =>
          onChange({
            institutionId: e.target.value || undefined,
            year: undefined,
          })
        }
      >
        <option value="">Todas</option>
        {catalog?.institutions
          .filter((i) => (catalog.institutionYears[i.id]?.length ?? 0) > 0)
          .map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
      </Select>

      <Select
        label="Ano"
        value={value.year ?? ''}
        onChange={(e) => onChange({ year: e.target.value ? Number(e.target.value) : undefined })}
      >
        <option value="">Todos</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>

      <Select
        label="Matéria"
        value={value.subjectId ?? ''}
        onChange={(e) => onChange({ subjectId: e.target.value || undefined, topicId: undefined })}
      >
        <option value="">Todas</option>
        {catalog?.subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>

      <Select
        label="Assunto"
        value={value.topicId ?? ''}
        disabled={!subject}
        onChange={(e) => onChange({ topicId: e.target.value || undefined })}
      >
        <option value="">{subject ? 'Todos os assuntos' : 'Escolha uma matéria'}</option>
        {subject?.topics.map((t) => (
          <optgroup key={t.id} label={t.name}>
            <option value={t.id}>Todos de {t.name}</option>
            {t.children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Dificuldade</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {DIFFICULTIES.map((d) => {
            const active = value.difficulty === d;
            return (
              <button
                key={d ?? 'all'}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ difficulty: d })}
                className={cn(
                  'h-10 rounded-lg border-2 border-line-soft px-1 text-sm font-semibold hover:bg-surface-2',
                  active && 'border-line bg-highlight text-[#14213d] shadow-hard-sm',
                )}
              >
                {d ? DIFFICULTY_LABELS[d] : 'Todas'}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2" disabled={!loggedIn}>
        <legend className="mb-1.5 text-sm font-semibold">Meu progresso</legend>
        <Toggle
          label="Não respondidas"
          checked={Boolean(value.onlyUnanswered)}
          onChange={(v) => onChange({ onlyUnanswered: v || undefined })}
        />
        <Toggle
          label="Que errei"
          checked={Boolean(value.onlyWrong)}
          onChange={(v) => onChange({ onlyWrong: v || undefined })}
        />
        <Toggle
          label="Salvas"
          checked={Boolean(value.onlySaved)}
          onChange={(v) => onChange({ onlySaved: v || undefined })}
        />
        {!loggedIn && (
          <p className="text-xs text-muted">Entre na sua conta para filtrar pelo seu progresso.</p>
        )}
      </fieldset>

      {hasActiveFilters(value) && (
        <Button type="button" variant="ghost" size="sm" onClick={onReset} className="w-full">
          <X className="size-4" aria-hidden />
          Limpar filtros
        </Button>
      )}
    </form>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-1 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
    >
      <span className="text-sm font-medium">{label}</span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full border-2 border-line bg-surface-2 transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:border-2 after:border-line after:bg-surface after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
      />
    </label>
  );
}
