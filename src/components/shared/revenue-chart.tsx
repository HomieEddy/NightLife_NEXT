"use client";

import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatMoney } from "@/features/shared/format";
import { cn } from "@/features/shared/utils";
import type { RevenuePoint } from "@/lib/types";

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: RevenuePoint }[];
}) => {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-2 py-1 text-xs shadow-md">
      <span className="font-semibold">{formatMoney(point.revenue)}</span>
      <span className="text-muted-foreground"> · {point.orders} orders</span>
    </div>
  );
};

export function RevenueChart({
  data,
  className,
  height = 180,
}: {
  data: RevenuePoint[];
  className?: string;
  height?: number;
}) {
  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-gold)" />
              <stop offset="50%" stopColor="var(--color-primary)" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-muted)", opacity: 0.3 }} />
          <Bar dataKey="revenue" fill="url(#revenueGradient)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
