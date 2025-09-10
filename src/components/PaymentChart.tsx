import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, BarChart3, List } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface PaymentData {
  month: string;
  amount: number;
  discount?: number;
}

interface PaymentChartProps {
  data: PaymentData[];
  selectedCategory?: string | null;
  selectedMonth?: string | null;
  onMonthSelect?: (month: string | null) => void;
}

type ViewMode = "chart" | "list";

export const PaymentChart = ({ data, selectedCategory, selectedMonth, onMonthSelect }: PaymentChartProps) => {
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? "list" : "chart");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-sm text-primary">
            Total: {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Normaliza os dados recebidos para garantir 12 meses (Jan–Dez)
  const monthsOrder = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const incomingMap = data.reduce<Record<string, number>>((acc, item) => {
    const key = item.month.replace('.', '');
    acc[key] = (acc[key] || 0) + item.amount;
    return acc;
  }, {});
  const fullData = monthsOrder.map(m => ({ month: m, amount: incomingMap[m] || 0 }));

  const totalAmount = fullData.reduce((sum, item) => sum + item.amount, 0);
  const maxAmount = Math.max(...fullData.map(item => item.amount), 0);

  const handleBarClick = (evt: any) => {
    if (!onMonthSelect) return;
    let label: string | null = null;
    if (evt?.activeLabel) label = String(evt.activeLabel);
    else if (evt?.payload?.month) label = String(evt.payload.month);
    if (!label) return;
    const normalized = label.replace('.', '');
    const newSelectedMonth = selectedMonth === normalized ? null : normalized;
    onMonthSelect(newSelectedMonth);
  };

  // Transform data to include color information for highlighting
  const chartData = fullData.map(item => ({
    ...item,
    fill: selectedMonth === item.month
      ? 'hsl(var(--primary))'
      : selectedMonth
        ? 'hsl(var(--muted-foreground) / 0.3)'
        : 'hsl(var(--primary))'
  }));

  const ChartView = () => (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={chartData} 
          margin={{ 
            top: 20, 
            right: isMobile ? 10 : 30, 
            left: isMobile ? 10 : 20, 
            bottom: 5 
          }}
          onClick={handleBarClick}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="month" 
            className="text-sm text-muted-foreground"
            tick={{ fontSize: isMobile ? 10 : 12 }}
          />
          <YAxis 
            className="text-sm text-muted-foreground"
            tick={{ fontSize: isMobile ? 10 : 12 }}
            tickFormatter={(value) => isMobile ? 
              `R$ ${(value / 1000).toFixed(0)}k` : 
              formatCurrency(value)
            }
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="amount" 
            radius={[4, 4, 0, 0]}
            onClick={handleBarClick}
            className="cursor-pointer"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const ListView = () => (
    <ScrollArea className="h-[300px]">
      <div className="space-y-3 pr-4">
        {fullData.map((item, index) => (
          <div 
            key={index}
            className={`flex items-center justify-between p-4 border rounded-lg transition-colors cursor-pointer ${
              selectedMonth === item.month 
                ? "bg-primary/10 border-primary ring-1 ring-primary" 
                : "hover:bg-muted/30"
            }`}
            onClick={() => onMonthSelect && onMonthSelect(selectedMonth === item.month ? null : item.month)}
          >
            <div className="flex-1">
              <p className={`font-medium ${selectedMonth === item.month ? "text-primary" : "text-foreground"}`}>
                {item.month}
                {selectedMonth === item.month && (
                  <span className="ml-2 text-xs font-normal">(Selecionado)</span>
                )}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      selectedMonth === item.month ? "bg-primary" : "bg-primary"
                    }`}
                    style={{ width: `${maxAmount ? (item.amount / maxAmount) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {totalAmount > 0 ? ((item.amount / totalAmount) * 100).toFixed(1) : "0.0"}%
                </span>
              </div>
            </div>
            <div className="text-right ml-4">
              <p className={`font-semibold ${selectedMonth === item.month ? "text-primary" : "text-foreground"}`}>
                {formatCurrency(item.amount)}
              </p>
              <Badge variant="secondary" className="text-xs">
                {item.amount === maxAmount && maxAmount > 0 ? "Maior" : ""}
              </Badge>
            </div>
          </div>
        ))}
        
        {fullData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum dado encontrado</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 min-w-0">
            <TrendingUp className="h-5 w-5 text-primary flex-shrink-0" />
            <span className="truncate">
              Histórico de Pagamentos
            </span>
          </CardTitle>
          
          {/* Seletor de visualização */}
          <div className="flex gap-1 bg-muted p-1 rounded-lg flex-shrink-0">
            <Button
              variant={viewMode === "chart" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("chart")}
              className="h-8 px-2 sm:px-3 min-w-0"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Gráfico</span>
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-8 px-2 sm:px-3 min-w-0"
            >
              <List className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Lista</span>
            </Button>
          </div>
        </div>
        
        {/* Categoria selecionada no mobile removida para independência */}
        
        {/* Resumo dos dados */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <div>
            <span>Total: {formatCurrency(totalAmount)}</span>
          </div>
          <div>
            <span>Períodos: {fullData.length}</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {viewMode === "chart" ? <ChartView /> : <ListView />}
      </CardContent>
    </Card>
  );
};