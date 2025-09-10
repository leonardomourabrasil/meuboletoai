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
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-2xl font-semibold mb-4">Total Gasto por Categoria</CardTitle>
        {externalRange?.startDate && externalRange?.endDate && (
          <div className="-mt-2 mb-2">
            <Badge variant="secondary" className="inline-flex">{externalMonthLabel}</Badge>
          </div>
        )}

        {/* Totais do período no cabeçalho */}
        <div className="-mt-2 mb-2 text-sm text-muted-foreground">
          Total do período: <span className="font-medium text-foreground">{formatCurrency(totalAmount)}</span>
          <span className="px-2">•</span>
          Qtd: <span className="font-medium text-foreground">{totalBills}</span>
        </div>
        
        {/* Seletor de visualização */}
        <div className="space-y-3">
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
            <Button
              variant={viewType === "trimestral" ? "default" : "outline"}
              size="sm"
              className="text-sm"
              onClick={() => setViewType("trimestral")}
            >
              Trimestral
            </Button>
            <Button
              variant={viewType === "semestral" ? "default" : "outline"}
              size="sm"
              className="text-sm"
              onClick={() => setViewType("semestral")}
            >
              Semestral
            </Button>
            <Button
              variant={viewType === "custom" ? "default" : "outline"}
              size="sm"
              className="text-sm"
              onClick={() => setViewType("custom")}
            >
              Personalizado
            </Button>
          </div>

          {/* Controles específicos por visualização */}
          {viewType === 'trimestral' && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setSelectedQuarter(q => ({ ...q, year: q.year - 1 }))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium w-16 text-center">{selectedQuarter.year}</span>
              <Button variant="outline" size="icon" onClick={() => setSelectedQuarter(q => ({ ...q, year: q.year + 1 }))}>
                <ChevronRight className="h-4 w-4" />
              </Button>

              <div className="flex gap-2">
                {[1,2,3,4].map(q => (
                  <Button key={q}
                    size="sm"
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
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setSelectedSemester(s => ({ ...s, year: s.year - 1 }))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium w-16 text-center">{selectedSemester.year}</span>
              <Button variant="outline" size="icon" onClick={() => setSelectedSemester(s => ({ ...s, year: s.year + 1 }))}>
                <ChevronRight className="h-4 w-4" />
              </Button>

              <div className="flex gap-2">
                {[1,2].map(s => (
                  <Button key={s}
                    size="sm"
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
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[180px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}> 
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : <span>Início</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={(d:any) => setStartDate(d as Date)} initialFocus />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[180px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}> 
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : <span>Fim</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={(d:any) => setEndDate(d as Date)} initialFocus />
                </PopoverContent>
              </Popover>

              {(startDate || endDate) && (
                <Button variant="ghost" size="sm" onClick={() => { setStartDate(undefined); setEndDate(undefined); }}>
                  Limpar
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-4 pt-0 min-h-[360px] sm:min-h-[420px]">
        {calculatedData.length > 0 ? (
          <div className="h-full w-full">
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="secondary">{basisLabel}</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="w-[200px]">% do Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculatedData.map((item) => {
                  const value = (item as any).displayAmount as number;
                  const pct = totalForPct ? Math.round((value / totalForPct) * 1000) / 10 : 0;
                  return (
                    <TableRow key={item.category}>
                      <TableCell className="font-medium">{item.category}</TableCell>
                      <TableCell className="text-right">{formatCurrency(value)}</TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-2" />
                          <span className="w-12 text-right text-sm tabular-nums">{pct}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            Sem dados para exibir no período selecionado.
          </div>
        )}
      </CardContent>
    </Card>
  );
};