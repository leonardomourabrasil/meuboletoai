import { useState, useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
// removed chart import
// import { CategoryChart } from "@/components/CategoryChart";
// add table and progress imports
import { Table, TableHeader, TableRow, TableHead, TableCell, TableBody } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

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

// Tipos de visualização suportados
type ViewType = "total" | "custom" | "mensal" | "trimestral" | "semestral";

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
  const [annualYear, setAnnualYear] = useState<number>(now.getFullYear()); // anual removido

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
      case "custom":
        return { start: startDate, end: endDate };
      default:
        return {};
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  // Calcular dados baseados apenas nos boletos pagos
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

  // Variação por categoria vs mês anterior (apenas na aba Mensal)
  const previousMonthCategoryTotals = useMemo(() => {
    if (viewType !== 'mensal') return new Map<string, number>();

    // Usa o mesmo critério de intervalo e base da computação principal
    let { start } = computeRangeFor(viewType);
    let basis: 'paidAt' | 'dueDate' = 'dueDate';
    if (externalRange?.startDate && externalRange?.endDate) {
      start = externalRange.startDate;
      basis = externalBasis ?? 'paidAt';
    }

    // Se não houver referência de início, assume mês corrente
    const ref = start ?? new Date();
    const startPrev = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    const endPrev = new Date(ref.getFullYear(), ref.getMonth(), 0);

    const totals = new Map<string, number>();
    bills.forEach(b => {
      if (b.status !== 'paid' || !b.category) return;
      const basisStr = basis === 'dueDate' ? b.dueDate : b.paidAt;
      if (!basisStr) return;
      const d = new Date(basisStr);
      if (d >= startPrev && d <= endPrev) {
        const amount = b.amount - (b.discount || 0);
        totals.set(b.category!, (totals.get(b.category!) ?? 0) + amount);
      }
    });
    return totals;
  }, [bills, viewType, externalRange?.startDate, externalRange?.endDate, externalBasis]);

  const totalAmount = calculatedData.reduce((sum, item) => sum + (item as any).displayAmount, 0);
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

  // Define a base usada (vencimento vs pagamento) para o rótulo do gráfico
  const basisForLabel: "paidAt" | "dueDate" =
    externalRange?.startDate && externalRange?.endDate
      ? (externalBasis ?? "paidAt")
      : (viewType === "mensal" ? "dueDate" : "paidAt");
  const basisLabel = basisForLabel === "dueDate" ? "Base: Vencimento" : "Base: Pagamento";

  const totalForPct = useMemo(() => calculatedData.reduce((s, i) => s + (i as any).displayAmount, 0), [calculatedData]);

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 pb-3 sm:pb-4">
        <div className="flex items-center gap-2 mb-2 sm:mb-4">
          <CardTitle className="text-base sm:text-2xl font-semibold">Total Gasto por Categoria</CardTitle>
          <Badge variant="secondary" className="text-xs">{basisLabel}</Badge>
        </div>
        {externalRange?.startDate && externalRange?.endDate && (
          <div className="-mt-1 sm:-mt-2 mb-2">
            <Badge variant="secondary" className="inline-flex text-xs">{externalMonthLabel}</Badge>
          </div>
        )}

        {/* Totais do período no cabeçalho */}
        <div className="-mt-1 sm:-mt-2 mb-2 text-xs sm:text-sm text-muted-foreground">
          Total do período: <span className="font-medium text-foreground">{formatCurrency(totalAmount)}</span>
          <span className="px-1 sm:px-2">•</span>
          Qtd: <span className="font-medium text-foreground">{totalBills}</span>
        </div>
        
        {/* Seletor de visualização */}
        <div className="space-y-2 sm:space-y-3">
          <div className="flex gap-1 sm:gap-2 flex-wrap overflow-x-hidden -mx-1 px-1 sm:mx-0 sm:px-0">
            <Button
              variant={viewType === "total" ? "default" : "outline"}
              size="sm"
              className="text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
              onClick={() => setViewType("total")}
            >
              <span className="sm:hidden">Total</span>
              <span className="hidden sm:inline">Total</span>
            </Button>
            <Button
              variant={viewType === "mensal" ? "default" : "outline"}
              size="sm"
              className="text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
              onClick={() => setViewType("mensal")}
            >
              <span className="sm:hidden">Mens.</span>
              <span className="hidden sm:inline">Mensal</span>
            </Button>
            <Button
              variant={viewType === "trimestral" ? "default" : "outline"}
              size="sm"
              className="text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
              onClick={() => setViewType("trimestral")}
            >
              <span className="sm:hidden">Trim.</span>
              <span className="hidden sm:inline">Trimestral</span>
            </Button>
            <Button
              variant={viewType === "semestral" ? "default" : "outline"}
              size="sm"
              className="text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
              onClick={() => setViewType("semestral")}
            >
              <span className="sm:hidden">Sem.</span>
              <span className="hidden sm:inline">Semestral</span>
            </Button>
            <Button
              variant={viewType === "custom" ? "default" : "outline"}
              size="sm"
              className="text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
              onClick={() => setViewType("custom")}
            >
              <span className="sm:hidden">Pers.</span>
              <span className="hidden sm:inline">Personalizado</span>
            </Button>
          </div>

          {/* Controles específicos por visualização */}
          {viewType === 'trimestral' && (
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => setSelectedQuarter(q => ({ ...q, year: q.year - 1 }))}>
                <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <span className="text-xs sm:text-sm font-medium w-12 sm:w-16 text-center">{selectedQuarter.year}</span>
              <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => setSelectedQuarter(q => ({ ...q, year: q.year + 1 }))}>
                <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>

              <div className="flex gap-1 sm:gap-2">
                {[1,2,3,4].map(q => (
                  <Button key={q}
                    size="sm"
                    className="text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
                    variant={selectedQuarter.quarter === q ? 'default' : 'outline'}
                    onClick={() => setSelectedQuarter(prev => ({ ...prev, quarter: q as 1|2|3|4 }))}
                  >
                    {q}º Tri
                  </Button>
                ))}
              </div>
            </div>
          )}

          {viewType === 'semestral' && (
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => setSelectedSemester(s => ({ ...s, year: s.year - 1 }))}>
                <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <span className="text-xs sm:text-sm font-medium w-12 sm:w-16 text-center">{selectedSemester.year}</span>
              <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => setSelectedSemester(s => ({ ...s, year: s.year + 1 }))}>
                <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>

              <div className="flex gap-1 sm:gap-2">
                {[1,2].map(s => (
                  <Button key={s}
                    size="sm"
                    className="text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
                    variant={selectedSemester.semester === s ? 'default' : 'outline'}
                    onClick={() => setSelectedSemester(prev => ({ ...prev, semester: s as 1|2 }))}
                  >
                    {s}º Semestre
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* bloco anual removido */}

          {viewType === 'custom' && (
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[140px] sm:w-[180px] justify-start text-left font-normal text-xs sm:text-sm h-7 sm:h-8", !startDate && "text-muted-foreground")}> 
                    <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : <span>Início</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={(d:any) => setStartDate(d as Date)} initialFocus />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[140px] sm:w-[180px] justify-start text-left font-normal text-xs sm:text-sm h-7 sm:h-8", !endDate && "text-muted-foreground")}> 
                    <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : <span>Fim</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={(d:any) => setEndDate(d as Date)} initialFocus />
                </PopoverContent>
              </Popover>

              {(startDate || endDate) && (
                <Button variant="ghost" size="sm" className="text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3" onClick={() => { setStartDate(undefined); setEndDate(undefined); }}>
                  Limpar
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-3 sm:p-4 pt-0">
         {calculatedData.length > 0 ? (
           <div className="h-full w-full flex flex-col">
             <ScrollArea className="flex-1 min-h-0 w-full pr-1">
               <Table className="min-w-0 sm:min-w-[520px] table-fixed md:table-auto w-full">
                 <TableHeader className="sticky top-0 bg-background z-10">
                   <TableRow>
                     <TableHead className="text-xs sm:text-sm h-8 sm:h-12 px-2 sm:px-4">Categoria</TableHead>
                     <TableHead className="w-[100px] sm:w-[130px] md:w-[160px] text-right text-xs sm:text-sm h-8 sm:h-12 px-2 sm:px-4">Valor</TableHead>
                     <TableHead className="hidden md:table-cell md:w-[72px] text-right text-xs sm:text-sm h-8 sm:h-12 px-2 sm:px-4">Qtd</TableHead>
                     <TableHead className="hidden sm:table-cell sm:w-[140px] md:w-[200px] text-xs sm:text-sm h-8 sm:h-12 px-2 sm:px-4">
                       <span className="hidden sm:inline">% do Total</span>
                     </TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {calculatedData.map((item) => {
                     const value = (item as any).displayAmount as number;
                     const pct = totalForPct ? Math.round((value / totalForPct) * 1000) / 10 : 0;
                     // variação vs mês anterior (apenas na aba Mensal)
                     const prevAmount = viewType === 'mensal' ? (previousMonthCategoryTotals.get(item.category) ?? 0) : undefined;
                     const diff = prevAmount !== undefined ? (value - prevAmount) : 0;
                     const percentRaw = prevAmount !== undefined ? (prevAmount === 0 ? (value > 0 ? 100 : 0) : ((value - prevAmount) / prevAmount) * 100) : 0;
                     const percentChange = Math.round(percentRaw);
                     const absDiff = Math.abs(diff);
                     const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
                     const trendClass = diff > 0 ? 'text-destructive' : diff < 0 ? 'text-success' : 'text-muted-foreground';
                     return (
                       <TableRow key={item.category}>
                         <TableCell className="font-medium text-xs sm:text-sm py-2 sm:py-4 px-2 sm:px-4 leading-tight break-words max-w-[150px] sm:max-w-none">
                           {item.category}
                           {viewType === 'mensal' && (
                             <span className={cn("ml-2 text-[10px] sm:text-xs", trendClass)}>
                               {`${sign}${Math.abs(percentChange)}% (${formatCurrency(absDiff)})`}
                             </span>
                           )}
                           <div className="sm:hidden mt-1 flex items-center gap-2">
                             <Progress value={pct} className="h-1.5 w-full" />
                             <span className="w-10 text-right text-[11px] tabular-nums">{pct}%</span>
                           </div>
                         </TableCell>
                         <TableCell className="w-[100px] sm:w-[130px] md:w-[160px] text-right whitespace-nowrap text-xs sm:text-sm py-2 sm:py-4 px-2 sm:px-4">{formatCurrency(value)}</TableCell>
                         <TableCell className="hidden md:table-cell md:w-[72px] text-right text-xs sm:text-sm py-2 sm:py-4 px-2 sm:px-4">{item.count}</TableCell>
                         <TableCell className="hidden sm:table-cell sm:w-[140px] md:w-[200px] py-2 sm:py-4 px-2 sm:px-4">
                           <div className="flex items-center gap-1 sm:gap-2">
                             <Progress value={pct} className="h-1.5 sm:h-2 w-full" />
                             <span className="w-8 sm:w-10 md:w-12 text-right text-[11px] sm:text-sm tabular-nums">{pct}%</span>
                           </div>
                         </TableCell>
                       </TableRow>
                     );
                   })}
                 </TableBody>
               </Table>
             </ScrollArea>
           </div>
         ) : (
           <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
             Sem dados para exibir no período selecionado.
           </div>
         )}
      </CardContent>
    </Card>
  );
};