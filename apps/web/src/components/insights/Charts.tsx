import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AreaStat } from '@freenem/shared';
import { AREA_SHORT } from '@/lib/insights';

const tick = { fill: 'var(--muted)', fontSize: 12 };
const tooltipStyle = {
  background: 'var(--surface)',
  border: '2px solid var(--border)',
  borderRadius: 12,
  color: 'var(--ink)',
};

export function AreaRadar({ areas }: { areas: AreaStat[] }) {
  const data = areas.map((a) => ({
    area: AREA_SHORT[a.area],
    acerto: Math.round(a.accuracy * 100),
  }));
  return (
    <div className="h-64 w-full" aria-hidden>
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="var(--border-soft)" />
          <PolarAngleAxis dataKey="area" tick={tick} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            dataKey="acerto"
            name="Acerto (%)"
            stroke="var(--primary)"
            fill="var(--primary)"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${String(v)}%`} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface ScorePoint {
  label: string;
  value: number;
}

export function ScoreLine({
  data,
  domain,
  name,
}: {
  data: ScorePoint[];
  domain: [number, number];
  name: string;
}) {
  return (
    <div className="h-56 w-full" aria-hidden>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--border-soft)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={tick} stroke="var(--border-soft)" />
          <YAxis domain={domain} tick={tick} stroke="var(--border-soft)" width={48} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line
            type="monotone"
            dataKey="value"
            name={name}
            stroke="var(--accent)"
            strokeWidth={3}
            dot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--border)', strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
