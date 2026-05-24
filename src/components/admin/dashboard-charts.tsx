"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SALES = [
  { h: "12h", v: 320 },
  { h: "13h", v: 540 },
  { h: "14h", v: 880 },
  { h: "15h", v: 1240 },
  { h: "16h", v: 1620 },
  { h: "17h", v: 980 },
  { h: "18h", v: 760 },
];

const PREP = [
  { pdv: "Smash", min: 12 },
  { pdv: "Beer", min: 4 },
  { pdv: "Açaí", min: 8 },
  { pdv: "Coffee", min: 6 },
  { pdv: "Store", min: 2 },
];

const axis = { stroke: "#8B949E", fontSize: 11, fontFamily: "monospace" };
const tooltipStyle = {
  background: "#161B22",
  border: "1px solid #30363D",
  borderRadius: 0,
  color: "#C9D1D9",
  fontSize: 12,
};

export function DashboardCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      <div className="border border-palantir-border bg-palantir-surface p-3 sm:p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Vendas por Hora (R$)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={SALES}>
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#58A6FF" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#58A6FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="h" {...axis} />
            <YAxis {...axis} width={36} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="v" stroke="#58A6FF" fill="url(#g)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="border border-palantir-border bg-palantir-surface p-3 sm:p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Tempo Médio de Preparo (min)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={PREP}>
            <XAxis dataKey="pdv" {...axis} />
            <YAxis {...axis} width={28} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#1C2128" }} />
            <Bar dataKey="min" fill="#3FB950" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
