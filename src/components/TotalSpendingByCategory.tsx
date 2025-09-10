import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
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
    dueDate: string;
  }>;
  externalRange?: { startDate: Date; endDate: Date } | null;
  externalBasis?: "paidAt" | "dueDate";
}
// Removidos: onPeriodChange, externalCustomRange, externalPreset
// (linha de chave extra removida)

type ViewType = "total" | "custom" | "mensal" | "trimestral" | "semestral" | "anual";

export const TotalSpendingByCategory = ({ data, bills, externalRange, externalBasis }: TotalSpendingByCategoryProps) => {
  const [viewType, setViewType] = useState<ViewType>("total");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  // Seleções para trimestre e semestre
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1 as 1 | 2 | 3 | 4;
  const currentSemester = (now.getMonth() < 6 ? 1 : 2) as 1 | 2;

  const [selectedQuarter, setSelectedQuarter] = useState<{ year: number; quarter: 1 | 2 | 3 | 4 }>({
    year: now.getFullYear(),
    quarter: currentQuarter,
  });
  const [selectedSemester, setSelectedSemester] = useState<{ year: number; semester: 1 | 2 }>({
    year: now.getFullYear(),
    semester: currentSemester,
  });

  const [quarterYear, setQuarterYear] = useState<number>(now.getFullYear());
  const [semesterYear, setSemesterYear] = useState<number>(now.getFullYear());

  const getQuarterRange = (year: number, quarter: 1 | 2 | 3 | 4) => {
    const startMonth = (quarter - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0);
    return { start, end };
  };

  const getSemesterRange = (year: number, semester: 1 | 2) => {
    const startMonth = semester === 1 ? 0 : 6;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 6, 0);
    return { start, end };
  };

  const computeRangeFor = (type: ViewType): { start?: Date; end?: Date } => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    switch (type) {
      case "mensal": {
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // mês corrente
        return { start: startOfMonth, end };
      }
      case "trimestral": {
        const y = selectedQuarter?.year ?? now.getFullYear();
        const q = selectedQuarter?.quarter ?? (Math.floor(now.getMonth() / 3) + 1 as 1 | 2 | 3 | 4);
        return getQuarterRange(y, q);
      }
      case "semestral": {
        const y = selectedSemester?.year ?? now.getFullYear();
        const s = selectedSemester?.semester ?? ((now.getMonth() < 6 ? 1 : 2) as 1 | 2);
        return getSemesterRange(y, s);
      }
      case "anual": {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = now;
        return { start, end };
      }
      case "custom":
        return { start: startDate, end: endDate };
      default:
        return {};
    }
  };

  // Removidos: onPeriodChange, externalCustomRange, externalPreset

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  // Calcular dados baseados apenas nos boletos pagos (não usar dados mock)
  const calculatedData = useMemo(() => {
    // Intervalo padrão baseado na UI interna
    let { start, end } = computeRangeFor(viewType);

    // Base padrão: mensal => dueDate (exclui retroativos); demais => paidAt
    let basis: "paidAt" | "dueDate" = viewType === "mensal" ? "dueDate" : "paidAt";

    // Se vier filtro externo (ex.: clique no histórico), ele tem prioridade e usa a base indicada
    if (externalRange?.startDate && externalRange?.endDate) {
      start = externalRange.startDate;
      end = externalRange.endDate;
      basis = externalBasis ?? "paidAt";
    }

    const categoryTotals = new Map<string, { amount: number; count: number }>();

    const eligibleBills = bills.filter(bill => {
      if (bill.status !== "paid" || !bill.category) return false;
      if (!start && !end) return true; // visão Total

      const basisStr = basis === "dueDate" ? bill.dueDate : bill.paidAt;
      if (!basisStr) return false; // sem data base não entra

      const basisDate = new Date(basisStr);
      if (start && basisDate < start) return false;
      if (end && basisDate > end) return false;
      return true;
    });

    eligibleBills.forEach(bill => {
      const key = bill.category!;
      const amount = bill.amount - (bill.discount || 0);
      const entry = categoryTotals.get(key) || { amount: 0, count: 0 };
      entry.amount += amount;
      entry.count += 1;
      categoryTotals.set(key, entry);
    });

    const calculated = Array.from(categoryTotals.entries()).map(([category, { amount, count }]) => ({
      category,
      amount,
      count,
      displayAmount: amount
    }));

    return calculated.sort((a, b) => b.amount - a.amount);
  }, [bills, viewType, startDate, endDate, selectedQuarter, selectedSemester, externalRange, externalBasis]);

  const totalAmount = calculatedData.reduce((sum, item) => sum + item.displayAmount, 0);
  const totalBills = calculatedData.reduce((sum, item) => sum + item.count, 0);

  // Rótulo dinâmico do mês quando há filtro externo (histórico)
  const externalMonthLabel = useMemo(() => {
    if (externalRange?.startDate) {
      let name = externalRange.startDate.toLocaleDateString('pt-BR', { month: 'long' });
      name = name.charAt(0).toUpperCase() + name.slice(1);
      return `Mensal (${name})`;
    }
    return undefined;
  }, [externalRange?.startDate]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-2xl font-semibold mb-4">Total Gasto por Categoria</CardTitle>
        {externalRange?.startDate && externalRange?.endDate && (
          <div className="-mt-2 mb-2">
            <Badge variant="secondary" className="inline-flex">{externalMonthLabel}</Badge>
          </div>
        )}
        
        {/* Seletor de visualização */}
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={viewType === "total" ? "default" : "outline"}
              size="sm"
              className="text-sm"
              onClick={() => setViewType("total")}
            >
              Total
            </Button>
            <Button
              variant={viewType === "mensal" ? "default" : "outline"}
              size="sm"
              className="text-sm"
              onClick={() => setViewType("mensal")}
            >
              Mensal
            </Button>
            {/* O restante dos botões mantém classes padrão */}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-4 pt-0 min-h-[360px] sm:min-h-[420px]">
        {/* O gráfico real é renderizado pelo componente CategoryChart */}
      </CardContent>
    </Card>
  );
};