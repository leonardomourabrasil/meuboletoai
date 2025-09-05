import { useState, useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface CategorySpending {
  category: string;
  amount: number;
  count: number;
}

interface TotalSpendingByCategoryProps {
  data: CategorySpending[];
  bills: Array<{
    id: string;
    category?: string;
    amount: number;
    status: string;
    paidAt?: string;
    discount?: number;
  }>;
}

type ViewType = "total" | "custom";

export const TotalSpendingByCategory = ({ data, bills }: TotalSpendingByCategoryProps) => {
  const [viewType, setViewType] = useState<ViewType>("total");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  // Calcular dados baseados apenas nos boletos pagos (não usar dados mock)
  const calculatedData = useMemo(() => {
    if (viewType === "total") {
      // Calcular totais apenas dos boletos atuais que foram pagos
      const categoryTotals = new Map<string, { amount: number; count: number }>();
      
      // Somar apenas boletos que foram realmente pagos (usando valor líquido - desconto)
      bills.filter(bill => bill.status === "paid" && bill.category).forEach(bill => {
        const current = categoryTotals.get(bill.category!) || { amount: 0, count: 0 };
        const netAmount = bill.amount - (bill.discount || 0);
        categoryTotals.set(bill.category!, {
          amount: current.amount + netAmount,
          count: current.count + 1
        });
      });
      
      return Array.from(categoryTotals.entries()).map(([category, data]) => ({
        category,
        displayAmount: data.amount,
        count: data.count
      }));
    } else {
      // Período personalizado - filtrar por datas selecionadas
      if (!startDate || !endDate) {
        return [];
      }
      
      const categoryTotals = new Map<string, { amount: number; count: number }>();
      
      bills.filter(bill => {
        if (bill.status !== "paid" || !bill.paidAt || !bill.category) return false;
        const paidDate = new Date(bill.paidAt);
        return paidDate >= startDate && paidDate <= endDate;
      }).forEach(bill => {
        const current = categoryTotals.get(bill.category!) || { amount: 0, count: 0 };
        const netAmount = bill.amount - (bill.discount || 0);
        categoryTotals.set(bill.category!, {
          amount: current.amount + netAmount,
          count: current.count + 1
        });
      });
      
      return Array.from(categoryTotals.entries()).map(([category, data]) => ({
        category,
        displayAmount: data.amount,
        count: data.count
      }));
    }
  }, [bills, viewType, startDate, endDate]);

  const totalAmount = calculatedData.reduce((sum, item) => sum + item.displayAmount, 0);
  const totalBills = calculatedData.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-xl font-semibold mb-4">Total Gasto por Categoria</CardTitle>
        
        {/* Seletor de visualização */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={viewType === "total" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewType("total")}
            >
              Total
            </Button>
            <Button
              variant={viewType === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewType("custom")}
            >
              Período Personalizado
            </Button>
          </div>

          {/* Seletores de data para período personalizado */}
          {viewType === "custom" && (
            <div className="flex gap-2 flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Data inicial"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    className={cn("p-3 pointer-events-auto")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Data final"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    className={cn("p-3 pointer-events-auto")}
                    initialFocus
                    disabled={(date) => startDate ? date < startDate : false}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 space-y-4 overflow-auto">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">
              {viewType === "total" ? "Total Acumulado" : "Período Selecionado"}
            </p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</p>
          </div>
          <Badge variant="secondary">{totalBills} contas</Badge>
        </div>

        <div className="space-y-3">
          {calculatedData
            .sort((a, b) => b.displayAmount - a.displayAmount)
            .map((item) => (
              <div key={item.category} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{item.category}</p>
                  <p className="text-sm text-muted-foreground">{item.count} contas</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">{formatCurrency(item.displayAmount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalAmount > 0 ? ((item.displayAmount / totalAmount) * 100).toFixed(1) : "0"}%
                  </p>
                </div>
              </div>
            ))}
        </div>

        {calculatedData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma categoria encontrada</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};