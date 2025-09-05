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

// Real payment history data will be calculated from user's actual bills
type MonthlyPaymentData = {
  month: string;
  [category: string]: number | string;
};

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { bills, loading: billsLoading, addBill, updateBillStatus, deleteBill } = useBills();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

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

    // Contas pagas apenas do mês atual (para o card "Total Pago (Mês)")
    const paidBills = bills.filter(bill => {
      if (bill.status !== "paid" || !bill.paidAt) return false;
      
      const paidDate = new Date(bill.paidAt);
      return paidDate.getMonth() === currentMonth && 
             paidDate.getFullYear() === currentYear;
    });

    // Todas as contas pagas (para o novo card "Valor Total Pago Geral")
    const allPaidBills = bills.filter(bill => bill.status === "paid");

    const totalPending = allPendingBills.reduce((sum, bill) => sum + (bill.amount - (bill.discount || 0)), 0);
    const totalPaid = paidBills.reduce((sum, bill) => sum + (bill.amount - (bill.discount || 0)), 0);
    const totalPaidOverall = allPaidBills.reduce((sum, bill) => sum + (bill.amount - (bill.discount || 0)), 0);

    // Get bills due in next 7 days para o card "Próximos Vencimentos"
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingBills = allPendingBills.filter(bill => {
      const dueDate = new Date(bill.dueDate);
      return dueDate <= nextWeek;
    });

    return {
      totalPending,
      totalPaid,
      totalPaidOverall,
      upcomingCount: upcomingBills.length
    };
  }, [bills]);

  const categoryData = useMemo(() => {
    const categoryMap = new Map<string, { amount: number; count: number }>();
    
    bills.forEach(bill => {
      const current = categoryMap.get(bill.category) || { amount: 0, count: 0 };
      categoryMap.set(bill.category, {
        amount: current.amount + bill.amount,
        count: current.count + 1
      });
    });

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count
    }));
  }, [bills]);

  const paymentHistoryData = useMemo(() => {
    // Group paid bills by month and calculate totals
    const paidBills = bills.filter(bill => bill.status === 'paid');
    
    if (paidBills.length === 0) {
      return [];
    }

    // Group bills by month
    const monthlyData = paidBills.reduce((acc: Record<string, number>, bill) => {
      const month = new Date(bill.dueDate).toLocaleDateString('pt-BR', { month: 'short' });
      const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
      
      const netAmount = bill.amount - (bill.discount || 0);
      
      if (!selectedCategory) {
        // Sum all categories (using net amount)
        acc[capitalizedMonth] = (acc[capitalizedMonth] || 0) + netAmount;
      } else {
        // Filter by selected category (using net amount)
        if (bill.category === selectedCategory) {
          acc[capitalizedMonth] = (acc[capitalizedMonth] || 0) + netAmount;
        }
      }
      
      return acc;
    }, {});

    // Convert to array format expected by the chart
    return Object.entries(monthlyData)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => {
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return months.indexOf(a.month) - months.indexOf(b.month);
      });
  }, [bills, selectedCategory]);

  // Filter bills by selected month if applicable
  const filteredBillsByMonth = useMemo(() => {
    if (!selectedMonth) return bills;
    
    return bills.filter(bill => {
      const billDate = new Date(bill.dueDate);
      const monthMap: { [key: string]: number } = {
        'Jan': 0, 'Fev': 1, 'Mar': 2, 'Abr': 3, 'Mai': 4, 'Jun': 5,
        'Jul': 6, 'Ago': 7, 'Set': 8, 'Out': 9, 'Nov': 10, 'Dez': 11
      };
      return billDate.getMonth() === monthMap[selectedMonth];
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

  const filteredBills = useMemo(() => {
    let result = selectedMonth ? filteredBillsByMonth : bills;
    if (selectedCategory) {
      result = result.filter(bill => bill.category === selectedCategory);
    }
    return result;
  }, [bills, selectedCategory, selectedMonth, filteredBillsByMonth]);

  const pendingBills = filteredBills.filter(bill => bill.status === "pending")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  
  const paidBills = filteredBills.filter(bill => bill.status === "paid")
    .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

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
            title="Total a Pagar"
            value={formatCurrency(stats.totalPending)}
            icon={DollarSign}
            variant="warning"
            trend={{
              value: "12%",
              isPositive: false
            }}
          />
          <StatsCard
            title="Total Pago (Mês)"
            value={formatCurrency(stats.totalPaid)}
            icon={CreditCard}
            variant="success"
            trend={{
              value: "8%",
              isPositive: true
            }}
          />
          <StatsCard
            title="Próximos Vencimentos"
            value={stats.upcomingCount.toString()}
            icon={Calendar}
            variant="destructive"
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
              onMonthSelect={setSelectedMonth}
            />
          </div>
          
          {/* Category Charts - Responsive Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            {/* Category Chart with flexible height */}
            <div className="min-h-[350px] h-[400px] sm:h-[450px] xl:h-[500px]">
              <CategoryChart data={categoryData} />
            </div>
            {/* Total Spending Chart with matching height */}
            <div className="min-h-[350px] h-[400px] sm:h-[450px] xl:h-[500px]">
              <TotalSpendingByCategory 
                data={categoryData} 
                bills={bills}
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
          {selectedMonth && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Filtrado por mês: <strong>{selectedMonth}</strong>
              </span>
              <button
                onClick={() => setSelectedMonth(null)}
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
              bills={paidBills}
              onBillStatusChange={handleBillStatusChange}
              onBillDelete={handleDeleteBill}
              title="Contas Pagas"
              showCheckbox={false}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
