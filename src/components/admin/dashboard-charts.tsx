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

export interface SalesPoint {
  h: string;
  v: number;
}

export interface PrepPoint {
  pdv: string;
  min: number;
}

const axis = { stroke: "#8B949E", fontSize: 11, fontFamily: "monospace" };
const tooltipStyle = {
  background: "#161B22",
  border: "1px solid #30363D",
  borderRadius: 0,
  color: "#C9D1D9",
  fontSize: 12,
};

export function DashboardCharts({
  sales,
  prep,
}: {
  sales: SalesPoint[];
  prep: PrepPoint[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      <div className="border border-palantir-border bg-palantir-surface p-3 sm:p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Vendas por Hora (R$)</h2>
        {sales.length === 0 ? (
          <EmptyChart message="Nenhuma venda confirmada hoje" />
        ) : (
          <div role="img" aria-label="Gráfico de vendas confirmadas por hora">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={sales}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#58A6FF" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#58A6FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="h" {...axis} />
                <YAxis {...axis} width={44} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#58A6FF"
                  fill="url(#g)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="border border-palantir-border bg-palantir-surface p-3 sm:p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">
          Tempo Médio Real de Preparo (min)
        </h2>
        {prep.length === 0 ? (
          <EmptyChart message="Nenhum pedido concluído com tempo medido hoje" />
        ) : (
          <div role="img" aria-label="Gráfico de tempo médio real de preparo por PDV">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={prep}>
                <XAxis dataKey="pdv" {...axis} />
                <YAxis {...axis} width={36} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#1C2128" }} />
                <Bar dataKey="min" fill="#3FB950" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="grid h-[200px] place-items-center border border-dashed border-palantir-border bg-palantir-bg/40 px-4 text-center">
      <p className="mono text-xs text-palantir-muted">{message}</p>
    </div>
  );
}
