"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CollectionChart({ collected, pending }: { collected: number; pending: number }) {
  const data = [{ name: "This term", collected, pending }];

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Revenue vs. pending</CardTitle></CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
            <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} width={70} />
            <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="collected" stackId="a" fill="var(--primary)" radius={[4, 0, 0, 4]} name="Collected" />
            <Bar dataKey="pending" stackId="a" fill="var(--muted-foreground)" radius={[0, 4, 4, 0]} name="Pending" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
