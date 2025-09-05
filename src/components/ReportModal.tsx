import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import { Bill } from "./BillsList";

interface ReportModalProps {
  bills: Bill[];
}

export const ReportModal = ({ bills }: ReportModalProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  const generateReport = async () => {
    if (!startDate || !endDate) {
      alert("Por favor, preencha as datas de início e fim do período.");
      return;
    }

    setIsGenerating(true);
    
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Filtrar contas por período
      const filteredBills = bills.filter(bill => {
        const billDate = new Date(bill.dueDate);
        return billDate >= start && billDate <= end;
      });

      // Criar PDF
      const doc = new jsPDF();
      
      // Configurar fonte
      doc.setFont("helvetica");
      
      // Cabeçalho
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text("MeuBoleto AI - Relatório de Contas", 20, 30);
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Período: ${formatDate(startDate)} a ${formatDate(endDate)}`, 20, 45);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 20, 55);
      
      // Linha separadora
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 65, 190, 65);
      
      // Estatísticas
      const paidBills = filteredBills.filter(bill => bill.status === "paid");
      const pendingBills = filteredBills.filter(bill => bill.status === "pending");
      const totalPaid = paidBills.reduce((sum, bill) => sum + (bill.amount - (bill.discount || 0)), 0);
      const totalPending = pendingBills.reduce((sum, bill) => sum + (bill.amount - (bill.discount || 0)), 0);
      
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text("RESUMO", 20, 80);
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total de contas: ${filteredBills.length}`, 20, 95);
      doc.text(`Contas pagas: ${paidBills.length}`, 20, 105);
      doc.text(`Contas pendentes: ${pendingBills.length}`, 20, 115);
      doc.text(`Valor total pago: ${formatCurrency(totalPaid)}`, 20, 125);
      doc.text(`Valor total pendente: ${formatCurrency(totalPending)}`, 20, 135);
      
      // Lista de contas pagas
      let yPosition = 160;
      
      if (paidBills.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(34, 197, 94); // Verde
        doc.text("CONTAS PAGAS", 20, yPosition);
        yPosition += 15;
        
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        
        paidBills.forEach((bill, index) => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 30;
          }
          
          doc.text(`${bill.beneficiary}`, 20, yPosition);
          doc.text(`${formatCurrency(bill.amount)}`, 100, yPosition);
          doc.text(`${formatDate(bill.dueDate)}`, 140, yPosition);
          doc.text(`${bill.category || "N/A"}`, 170, yPosition);
          yPosition += 12;
        });
        
        yPosition += 10;
      }
      
      // Lista de contas pendentes
      if (pendingBills.length > 0) {
        if (yPosition > 200) {
          doc.addPage();
          yPosition = 30;
        }
        
        doc.setFontSize(14);
        doc.setTextColor(239, 68, 68); // Vermelho
        doc.text("CONTAS PENDENTES", 20, yPosition);
        yPosition += 15;
        
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        
        pendingBills.forEach((bill, index) => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 30;
          }
          
          doc.text(`${bill.beneficiary}`, 20, yPosition);
          doc.text(`${formatCurrency(bill.amount)}`, 100, yPosition);
          doc.text(`${formatDate(bill.dueDate)}`, 140, yPosition);
          doc.text(`${bill.category || "N/A"}`, 170, yPosition);
          yPosition += 12;
        });
      }
      
      // Rodapé
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pageCount}`, 180, 290);
        doc.text("MeuBoleto AI - Sistema Inteligente de Controle de Contas", 20, 290);
      }
      
      // Salvar PDF
      const fileName = `relatorio-contas-${format(start, "dd-MM-yyyy")}-a-${format(end, "dd-MM-yyyy")}.pdf`;
      doc.save(fileName);
      
      setIsOpen(false);
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      alert("Erro ao gerar relatório. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="h-8 sm:h-9 px-2 sm:px-3 gap-1 sm:gap-2 text-xs sm:text-sm min-w-[80px] sm:min-w-[120px]"
        >
          <FileDown className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="hidden sm:inline">Gerar Relatório</span>
          <span className="sm:hidden">Relatório</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-[500px] max-h-[90vh] overflow-y-auto sm:w-full mx-4 sm:mx-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <FileDown className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span className="truncate">Gerar Relatório PDF</span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            Selecione o período para gerar um relatório das suas contas em formato PDF A4.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 sm:space-y-6">
          {/* Data Inicial */}
          <div className="space-y-2">
            <Label htmlFor="start-date" className="text-sm font-medium">
              Data Inicial
            </Label>
            <div className="relative">
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-9 sm:pl-10 text-sm h-9 sm:h-10"
              />
              <Calendar className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          
          {/* Data Final */}
          <div className="space-y-2">
            <Label htmlFor="end-date" className="text-sm font-medium">
              Data Final
            </Label>
            <div className="relative">
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-9 sm:pl-10 text-sm h-9 sm:h-10"
              />
              <Calendar className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          
          {/* Info Box */}
          <div className="bg-muted/50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              💡 O relatório incluirá um resumo das contas pagas e pendentes no período selecionado, 
              organizados por categoria e com totais detalhados.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 pt-4 mt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            className="flex-1 text-sm h-9 sm:h-10"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={generateReport}
            disabled={isGenerating}
            className="flex-1 gap-1 sm:gap-2 text-sm h-9 sm:h-10"
          >
            {isGenerating ? (
              <>
                <div className="h-3 w-3 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-background border-t-foreground" />
                <span className="hidden sm:inline">Gerando...</span>
                <span className="sm:hidden">...</span>
              </>
            ) : (
              <>
                <FileDown className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Gerar PDF</span>
                <span className="sm:hidden">PDF</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};