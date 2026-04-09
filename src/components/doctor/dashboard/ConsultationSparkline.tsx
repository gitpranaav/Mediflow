"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

interface Point {
  day: string;
  count: number;
}

interface ConsultationSparklineProps {
  data: Point[];
}

export function ConsultationSparkline({ data }: ConsultationSparklineProps) {
  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--text-muted))" }} />
          <Tooltip
            contentStyle={{
              borderRadius: "var(--radius)",
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--bg-card))",
              color: "hsl(var(--text-primary))",
            }}
            labelStyle={{ color: "hsl(var(--text-muted))" }}
            cursor={false}
          />
          <Line type="monotone" dataKey="count" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
