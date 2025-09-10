import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StatsCard } from "@/components/StatsCard";
import { BillsList } from "@/components/BillsList";
import { PaymentChart } from "@/components/PaymentChart";
import { CategoryChart } from "@/components/CategoryChart";
import { TotalSpendingByCategory } from "@/components/TotalSpendingByCategory";
import { CategoryFilter } from "@/components/CategoryFilter";
import { AddBillModal } from "@/components/AddBillModal";
import { ReportModal } from "@/components/ReportModal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { DollarSign, CreditCard, TrendingUp, Calendar, Settings, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBills, BillForDisplay } from "@/hooks/useBills";
import { useUserSettings } from "@/hooks/useUserSettings";

// Real payment history data will be calculated from user's actual bills
type MonthlyPaymentData = {
  month: string;
  [category: string]: number | string;
};

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { bills, loading: billsLoading, addBill, addRetroBill, updateBillStatus, deleteBill } = useBills();
  const { settings } = useUserSettings();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [categoryPeriod, setCategoryPeriod] = useState<{
    preset: 'total' | 'custom' | 'mensal' | 'trimestral' | 'semestral' | 'anual';
    startDate?: Date;
    endDate?: Date;
  }>({ preset: 'total' });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const stats = useMemo(() => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // Todas as contas pendentes (independente do mês)
    const allPendingBills = bills.filter(bill => bill.status === "pending");

    // Contas pagas apenas do mês atual (agora por paidAt)
    const paidBills = bills.filter(bill => {
      if (bill.status !== "paid" || !bill.paidAt) return false;
      const paidDate = new Date(bill.paidAt);
      return paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear;
    });

    // Todas as contas pagas (para o card "Valor Total Pago Geral")
    const allPaidBills = bills.filter(bill => bill.status === "paid");

    const totalPending = allPendingBills.reduce((sum, bill) => sum + (bill.amount - (bill.discount || 0)), 0);
    const totalPaid = paidBills.reduce((sum, bill) => sum + (bill.amount - (bill.discount || 0)), 0);
    const totalPaidOverall = allPaidBills.reduce((sum, bill) => sum + (bill.amount - (bill.discount || 0)), 0);

    // Próximos vencimentos usando janela configurável (inclui vencidos)
    const windowDays = settings?.upcomingWindowDays ?? 7;
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() + windowDays);

    const upcomingBills = allPendingBills.filter(bill => {
      const dueDate = new Date(bill.dueDate);
      return dueDate <= limitDate; // mantém lógica incluindo datas passadas
    });
    const upcomingTotal = upcomingBills.reduce((sum, bill) => sum + (bill.amount - (bill.discount || 0)), 0);

    return {
      totalPending,
      totalPaid,
      totalPaidOverall,
      upcomingCount: upcomingBills.length,
      upcomingTotal,
    };
  }, [bills, settings?.upcomingWindowDays]);

  const categoryData = useMemo(() => {
    const { startDate: start, endDate: end, preset } = categoryPeriod;

    const categoryMap = new Map<string, { amount: number; count: number }>();

    const eligibleBills = bills.filter(bill => {
      if (bill.status !== 'paid' || !bill.category) return false;
      // Total: sem filtro de data
      if (preset === 'total') return true;
      // Custom sem intervalo completo => vazio
      if (preset === 'custom' && (!start || !end)) return false;

      // Ao clicar no histórico, usamos a base por dueDate para manter consistência com o gráfico de Histórico de Pagamentos
      const basisDateStr = (preset === 'custom') ? bill.dueDate : bill.paidAt;
      if (!basisDateStr) return false;
      const basisDate = new Date(basisDateStr);
      if (start && basisDate < start) return false;
      if (end && basisDate > end) return false;
      return true;
    });

    eligibleBills.forEach(bill => {
      const current = categoryMap.get(bill.category) || { amount: 0, count: 0 };
      const netAmount = bill.amount - (bill.discount || 0);
      categoryMap.set(bill.category, {
        amount: current.amount + netAmount,
        count: current.count + 1
      });
    });

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count
    }));
  }, [bills, categoryPeriod]);

  // HISTÓRICO DE PAGAMENTOS: agrupar por dueDate (sempre considerar o mês de vencimento)
  const paymentHistoryData = useMemo(() => {
    const paidBills = bills.filter(bill => bill.status === 'paid');

    const monthsOrder = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    // Inicializa todos os meses com 0
    const monthlyData = monthsOrder.reduce((acc: Record<string, number>, m) => {
      acc[m] = 0;
      return acc;
    }, {} as Record<string, number>);

    paidBills.forEach((bill) => {
      const basisDate = new Date(bill.dueDate);
      const short = basisDate.toLocaleDateString('pt-BR', { month: 'short' });
      // Normaliza para tirar ponto final (ex.: "Set.") e capitaliza a primeira letra
      const key = (short.charAt(0).toUpperCase() + short.slice(1)).replace('.', '');
      const netAmount = bill.amount - (bill.discount || 0);

      if (key in monthlyData) {
        monthlyData[key] += netAmount;
      }
    });

    return monthsOrder.map((m) => ({ month: m, amount: monthlyData[m] }));
  }, [bills]);

  // Helper: rótulo do mês -> intervalo daquele mês no ano atual
  const monthLabelToRange = (label: string) => {
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const key = label.replace('.', '');
    const idx = months.indexOf(key);
    const year = new Date().getFullYear();
    const start = new Date(year, idx, 1);
    const end = new Date(year, idx + 1, 0);
    return { start, end };
  };

  // Clique no mês: define período customizado; desmarcar: volta para total
  const handleMonthSelect = (month: string | null) => {
    setSelectedMonth(month);
    if (month) {
      const { start, end } = monthLabelToRange(month);
      setCategoryPeriod({ preset: 'custom', startDate: start, endDate: end });
    } else {
      setCategoryPeriod({ preset: 'total' });
    }
  };

  const selectedMonthRange = useMemo(() => {
    if (!selectedMonth) return null;
    const { start, end } = monthLabelToRange(selectedMonth);
    return { startDate: start, endDate: end };
  }, [selectedMonth]);

  // Rótulo dinâmico do mês selecionado, ex.: "Mensal (Agosto)"
  const selectedMonthLabel = useMemo(() => {
    if (!selectedMonth) return undefined;
    const { start } = monthLabelToRange(selectedMonth);
    let name = start.toLocaleDateString('pt-BR', { month: 'long' });
    name = name.charAt(0).toUpperCase() + name.slice(1);
    return `Mensal (${name})`;
  }, [selectedMonth]);

  // Ordem e chaves de meses iguais às do gráfico
  const monthsOrder = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const currentMonthKey = useMemo(() => {
    const m = new Date().toLocaleDateString('pt-BR', { month: 'short' });
    return (m.charAt(0).toUpperCase() + m.slice(1)).replace('.', '');
  }, []);
  const previousMonthKey = useMemo(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const m = prev.toLocaleDateString('pt-BR', { month: 'short' });
    return (m.charAt(0).toUpperCase() + m.slice(1)).replace('.', '');
  }, []);
  // Removida declaração duplicada de previousMonthKey que usava monthsOrder
  
  // TOTAL PAGO (MÊS) — sincronizado com o gráfico (por paidAt)
  const totalPaidCurrentMonthFromChart = useMemo(() => {
    const item = paymentHistoryData.find(d => d.month === currentMonthKey) as { month: string; amount: number } | undefined;
    return item ? Number(item.amount) : 0;
  }, [paymentHistoryData, currentMonthKey]);
  const totalPaidPreviousMonthFromChart = useMemo(() => {
    const item = paymentHistoryData.find(d => d.month === previousMonthKey) as { month: string; amount: number } | undefined;
    return item ? Number(item.amount) : 0;
  }, [paymentHistoryData, previousMonthKey]);
  const paidMoMPercentRaw = useMemo(() => {
    const prev = totalPaidPreviousMonthFromChart;
    const curr = totalPaidCurrentMonthFromChart;
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  }, [totalPaidPreviousMonthFromChart, totalPaidCurrentMonthFromChart]);
  const paidAbsDiff = useMemo(() => Math.abs(totalPaidCurrentMonthFromChart - totalPaidPreviousMonthFromChart), [totalPaidCurrentMonthFromChart, totalPaidPreviousMonthFromChart]);
  const paidTrend = useMemo(() => {
    const percentage = Number(paidMoMPercentRaw.toFixed(0));
    return { value: percentage, label: 'vs mês anterior', absolute: paidAbsDiff };
  }, [paidMoMPercentRaw, paidAbsDiff]);

  // TOTAL A PAGAR (Mês)
  // 1) Mapa só de pendências (valor exibido no card)
  const pendingMonthlyMap = useMemo(() => {
    const map: Record<string, number> = {};
    bills.filter(b => b.status === 'pending').forEach(b => {
      const m = new Date(b.dueDate).toLocaleDateString('pt-BR', { month: 'short' });
      const key = (m.charAt(0).toUpperCase() + m.slice(1)).replace('.', '');
      const net = b.amount - (b.discount || 0);
      map[key] = (map[key] || 0) + net;
    });
    return map;
  }, [bills]);
  const totalPendingCurrentMonth = pendingMonthlyMap[currentMonthKey] ?? 0;
  const totalPendingPreviousMonth = pendingMonthlyMap[previousMonthKey] ?? 0;

  // 2) Mapa com TODOS os boletos (pendentes + pagos) por dueDate — para trend considerar retroativos
  const allBillsMonthlyMap = useMemo(() => {
    const map: Record<string, number> = {};
    bills.forEach(b => {
      const m = new Date(b.dueDate).toLocaleDateString('pt-BR', { month: 'short' });
      const key = (m.charAt(0).toUpperCase() + m.slice(1)).replace('.', '');
      const net = b.amount - (b.discount || 0);
      map[key] = (map[key] || 0) + net;
    });
    return map;
  }, [bills]);
  const totalAllCurrentMonth = allBillsMonthlyMap[currentMonthKey] ?? 0;
  const totalAllPreviousMonth = allBillsMonthlyMap[previousMonthKey] ?? 0;

  const pendingMoMPercentRaw = useMemo(() => {
    const prev = totalAllPreviousMonth;
    const curr = totalAllCurrentMonth;
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  }, [totalAllPreviousMonth, totalAllCurrentMonth]);
  // Para "a pagar", queda é positiva (verde)
  const pendingAbsDiff = useMemo(() => Math.abs(totalAllCurrentMonth - totalAllPreviousMonth), [totalAllCurrentMonth, totalAllPreviousMonth]);
  const pendingTrend = useMemo(() => {
    const percentage = Number(pendingMoMPercentRaw.toFixed(0)); // sem inversão: + pior (vermelho), - melhor (verde)
    return { value: percentage, label: 'vs mês anterior', absolute: pendingAbsDiff };
  }, [pendingMoMPercentRaw, pendingAbsDiff]);

  // Filter bills by selected month (sempre por dueDate)
  const filteredBillsByMonth = useMemo(() => {
    if (!selectedMonth) return bills;
    const monthMap: { [key: string]: number } = {
      'Jan': 0, 'Fev': 1, 'Mar': 2, 'Abr': 3, 'Mai': 4, 'Jun': 5,
      'Jul': 6, 'Ago': 7, 'Set': 8, 'Out': 9, 'Nov': 10, 'Dez': 11
    };
    const key = selectedMonth.replace('.', '');
    return bills.filter(bill => {
      const basisDate = new Date(bill.dueDate);
      return basisDate.getMonth() === monthMap[key];
    });
  }, [bills, selectedMonth]);

  const categories = useMemo(() => {
    return Array.from(new Set(bills.map(bill => bill.category))).sort();
  }, [bills]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const handleBillStatusChange = (billId: string, newStatus: "pending" | "paid", paymentMethod?: string) => {
    updateBillStatus(billId, newStatus, paymentMethod);
  };

  const handleDeleteBill = (billId: string) => {
    deleteBill(billId);
  };

  const handleAddBill = (newBill: Omit<BillForDisplay, "id" | "status">) => {
    addBill(newBill);
  };
  const handleAddRetroBill = (retroBill: Omit<BillForDisplay, "id" | "status"> & { paidAt: string }) => {
    addRetroBill(retroBill);
  };

  const filteredBills = useMemo(() => {
    let result = selectedMonth ? filteredBillsByMonth : bills;
    if (selectedCategory) {
      result = result.filter(bill => bill.category === selectedCategory);
    }
    return result;
  }, [bills, selectedCategory, selectedMonth, filteredBillsByMonth]);

  const pendingBills = filteredBills.filter(bill => bill.status === "pending")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const paidBillsList = filteredBills.filter(bill => bill.status === "paid")
    .sort((a, b) => new Date((b.paidAt ?? b.dueDate)).getTime() - new Date((a.paidAt ?? a.dueDate)).getTime());

  if (authLoading || billsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Carregando...</h2>
          <p className="text-muted-foreground">Verificando autenticação</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18 lg:h-20">
            {/* Logo and Title */}
            <div className="flex-1 min-w-0 mr-4">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground truncate">
                MeuBoleto AI
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                Sistema Inteligente de Controle de Contas
              </p>
            </div>
            
            {/* Actions Container */}
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3">
              {/* User Info - Hidden on mobile, visible on larger screens */}
              <div className="hidden md:block text-right">
                <span className="text-sm text-muted-foreground">
                  Olá, {user.email}
                </span>
              </div>
              
              {/* Button Groups */}
              <div className="flex items-center gap-2">
                {/* Primary Action Buttons */}
                <div className="flex gap-1">
                  <ReportModal bills={bills} />
                  <AddBillModal onAddBill={handleAddBill} />
                </div>
                
                {/* Secondary Action Buttons */}
                <div className="flex gap-1">
                  <Link to="/configuracoes">
                    <Button variant="outline" size="sm" className="h-9 px-2 sm:px-3">
                      <Settings className="h-4 w-4" />
                      <span className="hidden lg:inline ml-2">Configurações</span>
                    </Button>
                  </Link>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={signOut}
                    className="h-9 px-2 sm:px-3"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden lg:inline ml-2">Sair</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <StatsCard
            title="Total a Pagar (Mês)"
            value={formatCurrency(totalPendingCurrentMonth)}
            icon={DollarSign}
            variant="warning"
            trend={pendingTrend}
          />
          <StatsCard
            title="Total Pago (Mês)"
            value={formatCurrency(totalPaidCurrentMonthFromChart)}
            icon={CreditCard}
            variant="success"
            trend={paidTrend}
          />
          <StatsCard
            title="Próximos Vencimentos"
            value={stats.upcomingCount.toString()}
            icon={Calendar}
            variant="destructive"
            subtitle={formatCurrency(stats.upcomingTotal)}
          />
          <StatsCard
            title="Valor Total Pago Geral"
            value={formatCurrency(stats.totalPaidOverall)}
            icon={TrendingUp}
            variant="default"
          />
        </div>

        {/* Charts */}
        <div className="space-y-4 sm:space-y-6 lg:space-y-8 mb-6 sm:mb-8">
          {/* Payment History Chart - Full Width */}
          <div className="w-full">
            <PaymentChart 
              data={paymentHistoryData} 
              selectedCategory={selectedCategory}
              selectedMonth={selectedMonth}
              onMonthSelect={handleMonthSelect}
            />
          </div>
          
          {/* Category Charts - Responsive Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            {/* Category Chart with flexible height */}
            <div className="min-h-[350px] h-[400px] sm:h-[450px] xl:h-[500px]">
              <CategoryChart data={categoryData} basisLabel={selectedMonth ? selectedMonthLabel : undefined} />
            </div>
            {/* Total Spending Chart with matching height */}
            <div className="min-h-[350px] h-[400px] sm:h-[450px] xl:h-[500px]">
              <TotalSpendingByCategory 
                data={categoryData} 
                bills={bills}
                externalRange={selectedMonthRange}
                externalBasis="dueDate"
              />
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-6">
          <CategoryFilter
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
          {/* Removido aviso de filtro por mês para manter independência entre seções */}
          {selectedMonth && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Filtrado por mês: <strong>{selectedMonth}</strong>
              </span>
              <button
                onClick={() => handleMonthSelect(null)}
                className="text-xs text-primary hover:underline"
              >
                Limpar filtro
              </button>
            </div>
          )}
        </div>

        {/* Bills Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          <div className="h-[400px] sm:h-[450px] md:h-[500px] lg:h-[550px]">
            <BillsList
              bills={pendingBills}
              onBillStatusChange={handleBillStatusChange}
              onBillDelete={handleDeleteBill}
              title="Contas a Pagar"
              showCheckbox={true}
            />
          </div>
          <div className="h-[400px] sm:h-[450px] md:h-[500px] lg:h-[550px]">
            <BillsList
              bills={paidBillsList}
              onBillStatusChange={handleBillStatusChange}
              onBillDelete={handleDeleteBill}
              title="Contas Pagas"
              showCheckbox={false}
              extraAction={
                <AddBillModal retro onAddBill={handleAddBill} onAddRetroBill={handleAddRetroBill} />
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
