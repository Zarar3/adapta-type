import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { WpmDataPoint } from '../../types';

interface Props {
  data: WpmDataPoint[];
  duration: number;
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  label?: number;
  payload?: TooltipPayload[];
}

function CustomTooltip({ active, label, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
      <p className="text-gray-400 mb-1">{label}s</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-mono font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function WpmGraph({ data, duration }: Props) {
  void duration;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="t"
          tick={{ fill: '#9ca3af', fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: '#374151' }}
        />
        <YAxis
          yAxisId="wpm"
          orientation="left"
          tick={{ fill: '#9ca3af', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="errors"
          orientation="right"
          tick={{ fill: '#9ca3af', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={30}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ color: '#9ca3af', fontSize: '12px', paddingTop: '8px' }}
        />
        <Bar yAxisId="errors" dataKey="errors" name="errors" fill="#ef4444" opacity={0.5} barSize={6} />
        <Line
          yAxisId="wpm"
          type="monotone"
          dataKey="wpm"
          name="wpm"
          stroke="#facc15"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#facc15' }}
        />
        <Line
          yAxisId="wpm"
          type="monotone"
          dataKey="raw"
          name="raw"
          stroke="#6b7280"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          dot={false}
          activeDot={{ r: 3, fill: '#6b7280' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
