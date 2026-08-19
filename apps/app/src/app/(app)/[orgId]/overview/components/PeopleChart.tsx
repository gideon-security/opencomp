'use client';

import * as React from 'react';
import { Label, Pie, PieChart } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@gideon-defender/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@gideon-defender/ui/chart';
import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PeopleChartData {
  completed: number;
  remaining: number;
}

interface PeopleChartProps {
  data?: PeopleChartData | null;
}

const CHART_COLORS = {
  completed: 'var(--color-primary)',
  remaining: 'var(--color-muted)',
};

export function PeopleChart({ data }: PeopleChartProps) {
  const t = useTranslations('overview');
  const chartData = React.useMemo(() => {
    if (!data) return [];
    const items = [
      {
        name: t('charts.compliant'),
        value: data.completed,
        fill: CHART_COLORS.completed,
      },
      {
        name: t('charts.remaining'),
        value: data.remaining,
        fill: CHART_COLORS.remaining,
      },
    ];
    return items.filter((item) => item.value > 0);
  }, [data, t]);

  if (!data) {
    return (
      <Card className="flex flex-col overflow-hidden border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">{t('charts.people')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center py-10">
          <div className="space-y-2 text-center">
            <div className="text-muted-foreground flex justify-center">
              <Info className="h-10 w-10 opacity-30" />
            </div>
            <p className="text-muted-foreground text-center text-sm">{t('common.noData')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartConfig = {
    value: {
      label: t('charts.peopleStatus'),
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="mx-auto h-[120px] max-w-[150px]">
      <PieChart
        width={120}
        height={120}
        margin={{
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        }}
      >
        <ChartTooltip cursor={false} content={<ChartTooltipContent isPercentage={true} />} />
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          innerRadius={35}
          outerRadius={50}
          paddingAngle={2}
          strokeWidth={2}
          cursor="pointer"
          animationDuration={500}
          animationBegin={100}
        >
          <Label
            content={({ viewBox }) => {
              if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                return (
                  <g>
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-foreground text-base font-medium select-none"
                      >
                        {data.completed}%
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) + 18}
                        className="fill-muted-foreground text-[9px] select-none"
                      >
                        {t('charts.people')}
                      </tspan>
                    </text>
                    <circle
                      cx={viewBox.cx}
                      cy={viewBox.cy}
                      r={32}
                      fill="none"
                      stroke="var(--color-border)"
                      strokeWidth={1}
                      strokeDasharray="2,2"
                    />
                  </g>
                );
              }
              return null;
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
