
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, File, Image, X, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  selectedFile?: File | null;
  disabled?: boolean;
}

export const FileUploader = ({ 
  onFileSelect, 
  onFileRemove, 
  selectedFile, 
  disabled = false 
}: FileUploaderProps) => {
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      console.log('FileUploader: Arquivo selecionado:', file.name, 'Tipo:', file.type);
      
      // Passar o arquivo diretamente para o componente pai
      // A conversão PDF->JPEG será feita no AddBillModal
      onFileSelect(file);
      
      // Create preview for images only
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }
      
      toast.success(`Arquivo "${file.name}" selecionado com sucesso!`);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxFiles: 1,
    maxSize: 10485760, // 10MB
    disabled,
    onDropRejected: (fileRejections) => {
      const rejection = fileRejections[0];
      if (rejection.errors[0]?.code === 'file-invalid-type') {
        toast.error("Formato não suportado. Use apenas PDF, JPG, JPEG ou PNG.");
      } else if (rejection.errors[0]?.code === 'too-many-files') {  
        toast.error("Selecione apenas um arquivo por vez.");
      } else if (rejection.errors[0]?.code === 'file-too-large') {
        toast.error("Arquivo muito grande. Máximo 10MB.");
      }
    }
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleRemoveFile = () => {
    onFileRemove();
    setPreview(null);
    toast.success("Arquivo removido.");
  };

  if (selectedFile) {
    return (
      <Card className="p-3 sm:p-4">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground text-sm sm:text-base">Arquivo Selecionado</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveFile}
              className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
            >
              <X className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
          
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0">
              {selectedFile.type === 'application/pdf' ? (
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-destructive" />
              ) : (
                <Image className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-medium text-xs sm:text-sm text-foreground truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)} • {selectedFile.type.includes('pdf') ? 'PDF' : 'Imagem'}
              </p>
            </div>
          </div>

          {preview && (
            <div className="mt-3 sm:mt-4">
              <img 
                src={preview} 
                alt="Preview do boleto" 
                className="max-w-full h-24 sm:h-32 object-contain rounded-lg border border-border mx-auto"
              />
            </div>
          )}

          <div className="bg-muted/50 p-2 sm:p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Processamento automático:</strong> {selectedFile.type === 'application/pdf' ? 'PDF será analisado diretamente pela IA.' : 'Arquivo será analisado automaticamente pela IA.'}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-4 sm:p-8 text-center transition-colors cursor-pointer",
          isDragActive 
            ? "border-primary bg-primary/5" 
            : "border-muted-foreground/25 hover:border-primary/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        
        <div className="space-y-3 sm:space-y-4">
          <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 bg-muted rounded-lg flex items-center justify-center">
            <Upload className={cn(
              "h-5 w-5 sm:h-6 sm:w-6",
              isDragActive ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
          
          <div className="space-y-1 sm:space-y-2">
            <p className="text-sm font-medium text-foreground">
              {isDragActive 
                ? "Solte o arquivo aqui..." 
                : "Upload de Boleto"
              }
            </p>
            <p className="text-xs text-muted-foreground">
              Arraste e solte ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground">
              Formatos aceitos: PDF, JPG, JPEG, PNG (máx. 10MB)
              <br className="hidden sm:block" />
              <span className="sm:hidden"> • </span>PDFs são analisados diretamente
            </p>
          </div>
          
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            disabled={disabled}
            className="mx-auto h-8 sm:h-9 text-xs sm:text-sm"
          >
            <File className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Selecionar Arquivo
          </Button>
        </div>
      </div>
    </Card>
  );
};
