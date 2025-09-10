
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, LineChart, Line } from "recharts";
import { PieChart as PieChartIcon, BarChart3, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

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
  
  // Aumentar legibilidade geral
  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, outerRadius, percent, category }: any) => {
    const radius = outerRadius + 10;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill={(CATEGORY_COLORS as any)[category] || '#333'}
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        style={{ fontSize: 14, fontWeight: 600 }}
      >
        {`${category}: ${(percent * 100).toFixed(1)}%`}
      </text>
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

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return (
          <BarChart data={chartData}>
            <XAxis 
              dataKey="category" 
              fontSize={14}
              angle={-45}
              textAnchor="end"
              height={70}
              interval={0}
            />
            <YAxis 
              tickFormatter={formatCurrency} 
              fontSize={14}
              width={70}
            />
            <ChartTooltip content={<CustomTooltip />} />
            <Bar dataKey="amount">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={chartData}>
            <XAxis 
              dataKey="category" 
              fontSize={14}
              angle={-45}
              textAnchor="end"
              height={70}
              interval={0}
            />
            <YAxis 
              tickFormatter={formatCurrency} 
              fontSize={14}
              width={70}
            />
            <ChartTooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="amount" 
              stroke="hsl(280, 65%, 60%)" 
              strokeWidth={3}
              dot={{ fill: "hsl(280, 65%, 60%)", strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        );
      default:
        return (
          <PieChart>
            <Pie
              data={chartData}
              dataKey="amount"
              nameKey="category"
              cx="50%"
              cy="50%"
              outerRadius="75%"
              label={renderCustomizedLabel}
              labelLine={true}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={40}
              formatter={(value) => value}
              wrapperStyle={{ fontSize: '14px' }}
            />
          </PieChart>
        );
    }
  };

  const getIcon = () => {
    switch (chartType) {
      case 'bar': return BarChart3;
      case 'line': return TrendingUp;
      default: return PieChartIcon;
    }
  };

  const Icon = getIcon();

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
              <Badge variant="secondary" className="hidden sm:inline-flex">
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
      <CardContent className="flex-1 flex items-center p-4 pt-0 min-h-[360px] sm:min-h-[420px]">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
