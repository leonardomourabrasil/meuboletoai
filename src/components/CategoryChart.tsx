
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, LineChart, Line } from "recharts";
import { PieChart as PieChartIcon, BarChart3, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface CategoryData {
  category: string;
  amount: number;
  count: number;
}

interface CategoryChartProps {
  data: CategoryData[];
  basisLabel?: string;
}

const CATEGORY_COLORS = {
  "Energia": "hsl(45, 100%, 51%)",
  "Água": "hsl(200, 100%, 50%)",
  "Condomínio": "hsl(280, 65%, 60%)",
  "Internet": "hsl(120, 60%, 50%)",
  "Mercado": "hsl(15, 85%, 55%)",
  "Aluguel": "hsl(300, 70%, 50%)",
  "Gás": "hsl(340, 75%, 50%)",
  "Outros": "hsl(0, 0%, 50%)"
};

export const CategoryChart = ({ data, basisLabel }: CategoryChartProps) => {
  const [chartType, setChartType] = useState<'pie' | 'bar' | 'line'>('pie');
  const isMobile = useIsMobile();
  
  // Aumentar legibilidade geral
  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, outerRadius, percent, payload }: any) => {
    const radius = outerRadius + 10;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const category = payload?.category ?? payload?.name ?? '';
    return (
      <text
        x={x}
        y={y}
        fill={(CATEGORY_COLORS as any)[category] || '#333'}
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        style={{ fontSize: isMobile ? 10 : 12, fontWeight: 600 }}
      >
        {`${category}: ${(percent * 100).toFixed(1)}%`}
      </text>
    );
  };

  // Custom legend centralizada e adaptável (quebra em múltiplas linhas)
  const CustomLegend = ({ payload }: any) => {
    if (!payload) return null;
    return (
      <div className="w-full">
        <div className="mx-auto flex flex-wrap justify-center items-center gap-3 px-2 py-1 text-xs sm:text-sm">
          {payload.map((entry: any) => (
            <div key={entry.value} className="flex items-center gap-1 whitespace-nowrap">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: entry.color }} />
              <span>{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0
    }).format(value);
  };

  const chartData = data.map(item => ({
    ...item,
    fill: CATEGORY_COLORS[item.category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS["Outros"]
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-base font-medium">{data.category}</p>
          <p className="text-base text-primary">
            Valor: {formatCurrency(data.amount)}
          </p>
          <p className="text-sm text-muted-foreground">
            {data.count} conta{data.count > 1 ? 's' : ''}
          </p>
        </div>
      );
    }
    return null;
  };

  const chartConfig = data.reduce((config, item) => {
    config[item.category] = {
      label: item.category,
      color: CATEGORY_COLORS[item.category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS["Outros"]
    };
    return config;
  }, {} as any);

  // Altura da legenda dinâmica para acomodar múltiplas linhas
  const legendHeight = isMobile
    ? (data.length <= 3 ? 40 : data.length <= 6 ? 64 : 84)
    : (data.length <= 4 ? 40 : 56);

  // Choose icon based on current chart type
  const Icon = chartType === 'bar' ? BarChart3 : chartType === 'line' ? TrendingUp : PieChartIcon;

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return (
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: isMobile ? 24 : 32 }}>
            <XAxis
              dataKey="category"
              fontSize={isMobile ? 10 : 14}
              angle={isMobile ? -30 : -45}
              textAnchor="end"
              height={isMobile ? 50 : 70}
              interval={0}
            />
            <YAxis
              tickFormatter={formatCurrency}
              fontSize={isMobile ? 10 : 14}
              width={isMobile ? 46 : 70}
            />
            <ChartTooltip content={<CustomTooltip />} />
            <Bar dataKey="amount">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
            <Legend verticalAlign="bottom" align="center" height={legendHeight} content={(props) => <CustomLegend {...props} />} />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: isMobile ? 24 : 32 }}>
            <XAxis
              dataKey="category"
              fontSize={isMobile ? 10 : 14}
              angle={isMobile ? -30 : -45}
              textAnchor="end"
              height={isMobile ? 50 : 70}
              interval={0}
            />
            <YAxis
              tickFormatter={formatCurrency}
              fontSize={isMobile ? 10 : 14}
              width={isMobile ? 46 : 70}
            />
            <ChartTooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="hsl(280, 65%, 60%)"
              strokeWidth={3}
              dot={{ fill: "hsl(280, 65%, 60%)", strokeWidth: 2, r: isMobile ? 3 : 4 }}
            />
            <Legend verticalAlign="bottom" align="center" height={legendHeight} content={(props) => <CustomLegend {...props} />} />
          </LineChart>
        );
      default:
        return (
          <PieChart margin={{ top: 10, right: 10, left: 10, bottom: Math.max(legendHeight - 24, isMobile ? 24 : 32) }}>
            <Pie
              data={chartData}
              dataKey="amount"
              nameKey="category"
              cx="50%"
              cy="50%"
              outerRadius={isMobile ? "62%" : "72%"}
              label={renderCustomizedLabel}
              labelLine={true}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip content={<CustomTooltip />} />
            <Legend verticalAlign="bottom" align="center" height={legendHeight} content={(props) => <CustomLegend {...props} />} />
          </PieChart>
        );
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-6 w-6 text-primary" />
            <span className="text-lg sm:text-xl">Gastos por Categoria</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {basisLabel && (
              <Badge variant="secondary" className="inline-flex text-xs sm:text-sm">
                {basisLabel}
              </Badge>
            )}
            <div className="flex gap-1">
              <Button
                variant={chartType === 'pie' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('pie')}
                className="h-8 w-8 p-0"
              >
                <PieChartIcon className="h-5 w-5" />
              </Button>
              <Button
                variant={chartType === 'bar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('bar')}
                className="h-8 w-8 p-0"
              >
                <BarChart3 className="h-5 w-5" />
              </Button>
              <Button
                variant={chartType === 'line' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('line')}
                className="h-8 w-8 p-0"
              >
                <TrendingUp className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex items-center p-4 pt-0 min-h-[220px] sm:min-h-[360px] md:min-h-[420px]">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
