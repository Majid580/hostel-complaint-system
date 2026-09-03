"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/primitives";
import type { Overview } from "@/lib/services/analytics";
import { SEVERITIES, SEVERITY_META, STATUS_META, STATUSES } from "@/lib/domain/constants";

/**
 * Charts use CSS custom properties so they follow the light/dark theme without
 * a second palette. Recharts needs concrete strings, so we read the tokens.
 */
const SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

const SEVERITY_COLOR: Record<string, string> = {
  LOW: "var(--chart-6)",
  MEDIUM: "var(--chart-1)",
  HIGH: "var(--chart-3)",
  CRITICAL: "var(--chart-4)",
};

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  fontSize: "12px",
  color: "var(--popover-foreground)",
};

export function AnalyticsCharts({ overview }: { overview: Overview }) {
  const statusData = STATUSES.filter((s) => overview.statusCounts[s] > 0).map((s, i) => ({
    name: STATUS_META[s].label,
    value: overview.statusCounts[s],
    fill: SERIES[i % SERIES.length],
  }));

  const severityData = SEVERITIES.map((s) => ({
    name: SEVERITY_META[s].label,
    open: overview.severityCounts[s],
    fill: SEVERITY_COLOR[s],
  }));

  const trendData = overview.trend.map((t) => ({
    date: t.date.slice(5),
    filed: t.filed,
  }));

  const categoryData = overview.categories.slice(0, 8).map((c) => ({
    name: c.label,
    total: c.total,
    open: c.open,
  }));

  return (
    <div className="space-y-4">
      {/* ---------- Trend ---------- */}
      <Card>
        <CardContent className="p-5 pt-5">
          <h2 className="font-semibold">Complaints filed over time</h2>
          <div className="mt-4 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="filedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--border)" }} />
                <Area
                  type="monotone"
                  dataKey="filed"
                  name="Filed"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#filedGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------- Status mix ---------- */}
        <Card>
          <CardContent className="p-5 pt-5">
            <h2 className="font-semibold">Where complaints stand</h2>
            {statusData.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No complaints yet.</p>
            ) : (
              <div className="mt-2 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {statusData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend
                      wrapperStyle={{ fontSize: "11px" }}
                      iconType="circle"
                      iconSize={8}
                      layout="horizontal"
                      align="center"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---------- Severity ---------- */}
        <Card>
          <CardContent className="p-5 pt-5">
            <h2 className="font-semibold">Open complaints by severity</h2>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="open" name="Open" radius={[6, 6, 0, 0]}>
                    {severityData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---------- Categories ---------- */}
      <Card>
        <CardContent className="p-5 pt-5">
          <h2 className="font-semibold">What residents complain about most</h2>
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryData}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                <Legend wrapperStyle={{ fontSize: "11px" }} iconType="circle" iconSize={8} />
                <Bar dataKey="total" name="Total" fill="var(--chart-1)" radius={[0, 5, 5, 0]} />
                <Bar dataKey="open" name="Still open" fill="var(--chart-3)" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Hostel comparison ---------- */}
      {overview.hostels.some((h) => h.total > 0) && (
        <Card>
          <CardContent className="p-5 pt-5">
            <h2 className="font-semibold">Hostel comparison</h2>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={overview.hostels}
                  margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} iconType="circle" iconSize={8} />
                  <Bar dataKey="total" name="Total" fill="var(--chart-1)" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="open" name="Open" fill="var(--chart-2)" radius={[5, 5, 0, 0]} />
                  <Bar
                    dataKey="breached"
                    name="Past deadline"
                    fill="var(--chart-4)"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
