import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Bot, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { BillForDisplay } from "@/hooks/useBills";
import { FileUploader } from "./FileUploader";
import { analyzeBillWithAI, getApiKey } from "@/lib/ocr-service";
import { useToast } from "@/hooks/use-toast";
import { isPdfFile, convertPdfToJpeg } from "@/lib/pdf-converter";

interface AddBillModalProps {
  onAddBill: (bill: Omit<BillForDisplay, "id" | "status">) => void;
  retro?: boolean; // novo: modo retroativo
  onAddRetroBill?: (bill: Omit<BillForDisplay, "id" | "status"> & { paidAt: string }) => void; // callback para retroativo
}

export const AddBillModal = ({ onAddBill, retro = false, onAddRetroBill }: AddBillModalProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [beneficiary, setBeneficiary] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const [paymentDate, setPaymentDate] = useState<Date>(); // novo
  const [category, setCategory] = useState("");
  const [barcode, setBarcode] = useState("");
  const [discount, setDiscount] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadMode, setUploadMode] = useState<"upload" | "manual">("upload");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Se estiver no modo upload e tiver arquivo, mas campos vazios, mostrar aviso
    if (uploadMode === "upload" && selectedFile && (!beneficiary || !amount || !dueDate || (retro && !paymentDate))) {
      // permitir submit após IA preencher
    }
    
    // Se estiver no modo manual, exigir todos os campos (e paymentDate no modo retro)
    if (uploadMode === "manual" && (!beneficiary || !amount || !dueDate || (retro && !paymentDate))) {
      return;
    }
    
    // Se não há arquivo e não há dados manuais suficientes
    if (!selectedFile && (!beneficiary || !amount || !dueDate || (retro && !paymentDate))) {
      return;
    }

    const base = {
      beneficiary: beneficiary || `Boleto ${selectedFile?.name?.split('.')[0] || 'Importado'}`,
      amount: amount ? parseFloat(amount.replace(/[^\d,]/g, '').replace(',', '.')) : 0,
      dueDate: dueDate ? dueDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      category: category || "Importado",
      barcode: barcode || "",
      discount: discount ? parseFloat(discount.replace(/[^\d,]/g, '').replace(',', '.')) : 0
    } as const;

    if (retro && onAddRetroBill) {
      const paidAt = (paymentDate ?? new Date()).toISOString().split('T')[0];
      onAddRetroBill({ ...base, paidAt });
    } else {
      onAddBill(base);
    }
    
    // Reset form
    setBeneficiary("");
    setAmount("");
    setDueDate(undefined);
    setPaymentDate(undefined);
    setCategory("");
    setBarcode("");
    setDiscount("");
    setSelectedFile(null);
    setSelectedFiles([]);
    setAnalysisComplete(false);
    setIsAnalyzing(false);
    setUploadMode("upload");
    setAiSummary(null);
    setAnalysisResult(null);
    setIsOpen(false);
  };

  const handleFileSelect = async (originalFile: File) => {
    console.log('📄 Arquivo recebido:', originalFile.name, 'Tipo:', originalFile.type, 'Tamanho:', originalFile.size);
    
    // Novo fluxo: PDFs são processados diretamente
    setSelectedFile(originalFile);
    setSelectedFiles([originalFile]);
    setAnalysisComplete(false);
    
    console.log('💾 Estado atualizado:');
    console.log('  - Arquivo salvo:', originalFile.name);
    console.log('  - Tipo:', originalFile.type);

    // Verificar API key para análise automática
    const apiKey = getApiKey();
    if (!apiKey) {
      console.log('🔑 API key não configurada - parando análise automática');
      toast({
        variant: "destructive",
        title: "API key não configurada",
        description: "Configure a chave da API de IA nas configurações para análise automática.",
      });
      
      // Preenchimento básico baseado no nome do arquivo
      if (!beneficiary) {
        const fileName = originalFile.name.split('.')[0];
        setBeneficiary(`Boleto ${fileName}`);
      }
      return;
    }

    // Verificar se é um tipo de arquivo suportado
    const isPDF = originalFile.type === 'application/pdf';
    const isImage = originalFile.type.startsWith('image/');
    
    if (!isPDF && !isImage) {
      console.error('❌ Tipo de arquivo não suportado:', originalFile.type);
      toast({
        variant: "destructive",
        title: "Formato não suportado",
        description: "Apenas arquivos PDF ou imagem são suportados para análise.",
      });
      return;
    }

    // Iniciar análise automática com IA
    console.log(`🤖 Iniciando análise ${isPDF ? 'do PDF' : 'da imagem'} com IA...`);
    console.log('   Arquivo:', originalFile.name);
    console.log('   Tipo:', originalFile.type);
    console.log('   Tamanho:', originalFile.size, 'bytes');
    
    setIsAnalyzing(true);
    
    try {
      // Nova implementação: suporte direto a PDF e imagem
      if (isPDF) {
        toast({
          title: "Analisando PDF",
          description: "A IA está lendo o PDF e gerando arquivo TXT intermediário...",
        });
      } else {
        toast({
          title: "Analisando imagem",
          description: "A IA está extraindo informações da imagem...",
        });
      }
      
      const analysis = await analyzeBillWithAI(originalFile, apiKey);
      
      console.log('✅ Análise da IA concluída:', analysis);
      
      // Salvar resultado da análise e mostrar resumo
      setAnalysisResult(analysis);
      setAiSummary(analysis.summary);
      setAnalysisComplete(true);
      
      toast({
        title: "Análise concluída!",
        description: `Resumo gerado com ${Math.round(analysis.confidence * 100)}% de confiança. Revise o resumo abaixo.`,
      });
    } catch (error) {
      console.error('❌ Erro na análise da IA:', error);
      toast({
        variant: "destructive",
        title: "Erro na análise",
        description: error instanceof Error ? error.message : "Erro ao analisar o arquivo",
      });
      
      // Preenchimento básico em caso de erro
      if (!beneficiary) {
        const fileName = originalFile.name.split('.')[0];
        setBeneficiary(`Boleto ${fileName}`);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
    setSelectedFiles([]);
    setAnalysisComplete(false);
    setIsAnalyzing(false);
    setAiSummary(null);
    setAnalysisResult(null);
  };

  const handleApplyAnalysis = () => {
    if (analysisResult) {
      setBeneficiary(analysisResult.beneficiary);
      // Converter o valor decimal para string em centavos para a função formatCurrency
      const valueInCents = Math.round(analysisResult.amount * 100).toString();
      setAmount(formatCurrency(valueInCents));
      
      // Converter a data de forma mais robusta para evitar problemas de timezone
      const dateParts = analysisResult.dueDate.split('-');
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed in JavaScript Date
      const day = parseInt(dateParts[2]);
      setDueDate(new Date(year, month, day));
      
      setCategory(analysisResult.category);
      setBarcode(analysisResult.barcode || "");
      // Converter o valor decimal para string em centavos para a função formatCurrency
      const discountInCents = Math.round((analysisResult.discount || 0) * 100).toString();
      setDiscount(formatCurrency(discountInCents));
      
      toast({
        title: "Dados aplicados!",
        description: "Os campos foram preenchidos com base no resumo da IA.",
      });
    }
  };

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const currency = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(Number(numbers) / 100);
    return currency;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setAmount(formatted);
  };

  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setDiscount(formatted);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          size="sm" 
          className="h-8 sm:h-9 px-2 sm:px-3 gap-1 sm:gap-2 text-xs sm:text-sm min-w-[80px] sm:min-w-[120px]"
        >
          <Plus className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="hidden sm:inline">{retro ? 'Adicionar Retroativo' : 'Nova Conta'}</span>
          <span className="sm:hidden">{retro ? 'Retroativo' : 'Nova'}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-[500px] max-h-[90vh] overflow-y-auto sm:w-full">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg sm:text-xl">{retro ? 'Adicionar Contas Pagas (Retroativo)' : 'Adicionar Nova Conta'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Upload/Manual Toggle */}
          <div className="flex flex-col sm:flex-row gap-2 p-1 bg-muted rounded-lg">
            <Button
              type="button"
              variant={uploadMode === "upload" ? "default" : "ghost"}
              size="sm"
              onClick={() => setUploadMode("upload")}
              className="flex-1 text-xs sm:text-sm"
            >
              {retro ? 'Comprovante' : 'Upload de Boleto'}
            </Button>
            <Button
              type="button"
              variant={uploadMode === "manual" ? "default" : "ghost"}
              size="sm"
              onClick={() => setUploadMode("manual")}
              className="flex-1 text-xs sm:text-sm"
            >
              {retro ? 'Preencher Dados' : 'Preencher Manualmente'}
            </Button>
          </div>

          {/* File Upload Section */}
          {uploadMode === "upload" && (
            <FileUploader
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              selectedFile={selectedFile}
            />
          )}
          
          {/* Campos manuais */}
          <div className={cn(
            "space-y-4 transition-opacity",
            uploadMode === "upload" && selectedFile ? "opacity-75" : "opacity-100"
          )}>
              {uploadMode === "upload" && selectedFile && (
                <div className="mb-4 space-y-3">
                  <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-xs sm:text-sm text-primary font-medium mb-1 break-all">
                      📄 Arquivo: {selectedFile.name}
                    </p>
                  {isAnalyzing && (
                    <div className="flex items-center gap-2 mt-2">
                      <Bot className="h-4 w-4 text-blue-600 animate-spin" />
                      <span className="text-xs text-blue-600">Analisando com IA...</span>
                    </div>
                  )}
                  {analysisComplete && !isAnalyzing && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-green-600 font-medium">
                          ✅ Análise concluída!
                        </span>
                      </div>
                      
                      {aiSummary && (
                        <div className="p-3 bg-muted rounded-lg border">
                          <h4 className="text-xs sm:text-sm font-medium mb-2">📋 Resumo das Informações:</h4>
                          <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-line break-words">
                            {aiSummary}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleApplyAnalysis}
                            className="mt-3 w-full text-xs sm:text-sm"
                          >
                            Preencher Campos Automaticamente
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  {!getApiKey() && !isAnalyzing && (
                    <div className="flex items-center gap-2 mt-2">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span className="text-xs text-amber-600">
                        Configure a API de IA nas configurações para análise automática.
                      </span>
                    </div>
                  )}
                </div>
                
                {!isAnalyzing && (
                  <p className="text-xs text-muted-foreground">
                    {analysisComplete 
                      ? aiSummary ? "Revise o resumo acima e clique em 'Preencher Campos' se estiver correto." : "Confirme ou ajuste os dados abaixo."
                      : "Confirme ou ajuste os dados abaixo."}
                  </p>
                )}
              </div>
            )}
            
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="beneficiary" className="text-sm">
                Favorecido/Beneficiário {uploadMode === "manual" && "*"}
              </Label>
              <Input
                id="beneficiary"
                value={beneficiary}
                onChange={(e) => setBeneficiary(e.target.value)}
                placeholder="Ex: Enel, Copasa, Banco XYZ..."
                required={uploadMode === "manual"}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="amount" className="text-sm">
                Valor {uploadMode === "manual" && "*"}
              </Label>
              <Input
                id="amount"
                value={amount}
                onChange={handleAmountChange}
                placeholder="R$ 0,00"
                required={uploadMode === "manual"}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label className="text-sm">
                Data de Vencimento {uploadMode === "manual" && "*"}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal text-sm h-9 sm:h-10",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                    <span className="truncate">
                      {dueDate ? format(dueDate, "dd 'de' MMM 'de' yyyy", { locale: ptBR }) : "Selecione uma data"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {retro && (
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-sm">
                  Data de Pagamento *
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal text-sm h-9 sm:h-10",
                        !paymentDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span className="truncate">
                        {paymentDate ? format(paymentDate, "dd 'de' MMM 'de' yyyy", { locale: ptBR }) : "Selecione uma data"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
                    <Calendar
                      mode="single"
                      selected={paymentDate}
                      onSelect={setPaymentDate}
                      initialFocus
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">Obrigatória para lançamento retroativo</p>
              </div>
            )}
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="category" className="text-sm">Categoria (opcional)</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: Energia, Água, Financiamento..."
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="discount" className="text-sm">Desconto (opcional)</Label>
              <Input
                id="discount"
                value={discount}
                onChange={handleDiscountChange}
                placeholder="R$ 0,00"
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Valor de desconto disponível se pago antecipadamente
              </p>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="barcode" className="text-sm">Código de Barras (opcional)</Label>
              <Input
                id="barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Ex: 34191790010104351004791020150008291070026000"
                className="text-sm font-mono"
              />
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
              type="submit" 
              className="flex-1 text-sm h-9 sm:h-10"
            >
              {retro ? 'Adicionar Retroativo' : (uploadMode === "upload" && selectedFile ? "Salvar Boleto" : "Adicionar Conta")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
