import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Settings as SettingsIcon,
  Mail,
  MessageSquare,
  Bot,
  Trash2,
  Save,
  Plus,
  Key,
  ArrowLeft,
  Clock,
  CheckCircle,
  BellRing,
  Loader2
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AI_PROVIDERS, type AIProvider } from "@/lib/ai-providers";
import { Link } from "react-router-dom";
import { useUserSettings, type UserSettings } from "@/hooks/useUserSettings";

interface EmailRecipient {
  id: string;
  email: string;
}

interface WhatsAppContact {
  id: string;
  name: string;
  phone: string;
}

const Settings = () => {
  const { toast } = useToast();
  const { settings, loading, saveSettings } = useUserSettings();
  
  // Form states
  const [newEmail, setNewEmail] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [sendingReminders, setSendingReminders] = useState(false);

  // Atualizar apiKey quando settings mudarem
  useEffect(() => {
    setApiKey(settings.aiApiKey || "");
  }, [settings]);

  // Save settings to storage
  const handleSaveSettings = () => {
    const updatedSettings: UserSettings = { 
      ...settings, 
      aiApiKey: apiKey 
    };
    saveSettings(updatedSettings);
  };

  // Disparar lembretes manualmente
  const handleSendReminders = async () => {
    if (!settings.notificationsEnabled) {
      toast({
        variant: "destructive",
        title: "Notificações desativadas",
        description: "Ative as notificações para disparar lembretes.",
      });
      return;
    }

    try {
      setSendingReminders(true);
      const resp = await fetch("/api/send-reminders", { method: "POST" });
      const isJson = resp.headers.get("content-type")?.includes("application/json");
      const data = isJson ? await resp.json() : null;

      if (resp.ok) {
        const users = data?.usersProcessed ?? 0;
        const emails = data?.emailsSent ?? 0;
        const whats = data?.whatsappsSent ?? 0;
        toast({
          title: "Lembretes enviados",
          description: `Usuários: ${users} • E-mails: ${emails} • WhatsApp: ${whats}`,
        });
      } else if (resp.status === 404) {
        toast({
          variant: "destructive",
          title: "Endpoint indisponível",
          description: "No modo de desenvolvimento Vite, as rotas /api não estão ativas. Rode 'vercel dev' ou teste após o deploy.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Falha ao enviar lembretes",
          description: data?.error || `Status ${resp.status}`,
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Erro de rede",
        description: "Verifique sua conexão ou rode 'vercel dev' para usar as rotas /api localmente.",
      });
    } finally {
      setSendingReminders(false);
    }
  };

  // Email validation
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Phone number formatting
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    return value;
  };

  // Add email recipient
  const addEmailRecipient = () => {
    if (!newEmail.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, insira um endereço de e-mail.",
      });
      return;
    }

    if (!isValidEmail(newEmail)) {
      toast({
        variant: "destructive",
        title: "E-mail inválido",
        description: "Por favor, insira um endereço de e-mail válido.",
      });
      return;
    }

    // Check if email already exists
    if (settings.emailRecipients.some(recipient => recipient.email === newEmail)) {
      toast({
        variant: "destructive",
        title: "E-mail já existe",
        description: "Este endereço de e-mail já foi adicionado.",
      });
      return;
    }

    const newRecipient: EmailRecipient = {
      id: Date.now().toString(),
      email: newEmail
    };

    const updatedSettings = {
      ...settings,
      emailRecipients: [...settings.emailRecipients, newRecipient]
    };
    
    saveSettings(updatedSettings);
    setNewEmail("");
    toast({
      title: "E-mail adicionado",
      description: `${newEmail} foi adicionado à lista de destinatários.`,
    });
  };

  // Remove email recipient
  const removeEmailRecipient = (id: string) => {
    const updatedSettings = {
      ...settings,
      emailRecipients: settings.emailRecipients.filter(recipient => recipient.id !== id)
    };
    
    saveSettings(updatedSettings);
    toast({
      title: "E-mail removido",
      description: "O destinatário foi removido da lista.",
    });
  };

  // Add WhatsApp contact
  const addWhatsAppContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, preencha o nome e o número do WhatsApp.",
      });
      return;
    }

    const phone = newContactPhone.replace(/\D/g, "");
    if (phone.length < 10 || phone.length > 11) {
      toast({
        variant: "destructive",
        title: "Número inválido",
        description: "Por favor, insira um número de telefone válido.",
      });
      return;
    }

    const newContact: WhatsAppContact = {
      id: Date.now().toString(),
      name: newContactName,
      phone: newContactPhone
    };

    const updatedSettings = {
      ...settings,
      whatsappContacts: [...settings.whatsappContacts, newContact]
    };
    
    saveSettings(updatedSettings);
    setNewContactName("");
    setNewContactPhone("");
    toast({
      title: "Contato adicionado",
      description: `${newContactName} foi adicionado à lista de contatos.`,
    });
  };

  // Remove WhatsApp contact
  const removeWhatsAppContact = (id: string) => {
    const updatedSettings = {
      ...settings,
      whatsappContacts: settings.whatsappContacts.filter(contact => contact.id !== id)
    };
    
    saveSettings(updatedSettings);
    toast({
      title: "Contato removido",
      description: "O contato foi removido da lista.",
    });
  };

  // Handle phone input change
  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setNewContactPhone(formatted);
  };

  // Toggle reminder day selection
  const toggleReminderDay = (days: number) => {
    const updatedSettings = {
      ...settings,
      reminderDaysBefore: settings.reminderDaysBefore.includes(days)
        ? settings.reminderDaysBefore.filter(d => d !== days)
        : [...settings.reminderDaysBefore, days].sort((a, b) => a - b)
    };
    
    saveSettings(updatedSettings);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/">
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
              </Link>
              <SettingsIcon className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
                <p className="text-muted-foreground mt-1">Gerencie suas preferências e integrações</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* General Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-primary" />
                Gerenciamento Geral de Notificações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="notifications-toggle" className="text-base font-medium">
                    Habilitar Notificações
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Controle mestre para todas as notificações do sistema
                  </p>
                </div>
                <Switch
                  id="notifications-toggle"
                  checked={settings.notificationsEnabled}
                  onCheckedChange={(checked) => {
                    const updatedSettings = { ...settings, notificationsEnabled: checked };
                    saveSettings(updatedSettings);
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Email Recipients */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Destinatários de E-mail para Lembretes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder="exemplo@email.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addEmailRecipient()}
                  />
                </div>
                <Button onClick={addEmailRecipient} className="shrink-0">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar E-mail
                </Button>
              </div>

              {settings.emailRecipients.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">E-mails cadastrados:</Label>
                  <div className="space-y-2">
                    {settings.emailRecipients.map((recipient) => (
                      <div
                        key={recipient.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{recipient.email}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEmailRecipient(recipient.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* WhatsApp Recipients */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Destinatários de WhatsApp para Lembretes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input
                  placeholder="Nome do contato"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                />
                <Input
                  placeholder="(XX) XXXXX-XXXX"
                  value={newContactPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  maxLength={15}
                />
                <Button onClick={addWhatsAppContact} className="w-full">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Contato
                </Button>
              </div>

              {settings.whatsappContacts.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Contatos cadastrados:</Label>
                  <div className="space-y-2">
                    {settings.whatsappContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {contact.name} - {contact.phone}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeWhatsAppContact(contact.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reminder Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Configuração de Lembretes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="reminder-days" className="text-base font-medium">
                    Antecedência para Lembretes
                  </Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Quantos dias antes do vencimento deseja receber o lembrete
                  </p>
                </div>
                
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((days) => (
                    <Button
                      key={days}
                      variant={settings.reminderDaysBefore.includes(days) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleReminderDay(days)}
                      className="w-full"
                    >
                      {days} dia{days > 1 ? 's' : ''}
                    </Button>
                  ))}
                </div>
                
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">
                      {settings.reminderDaysBefore.length > 0 ? (
                        <>
                          Lembretes serão enviados {settings.reminderDaysBefore.length === 1 
                            ? `${settings.reminderDaysBefore[0]} dia${settings.reminderDaysBefore[0] > 1 ? 's' : ''} antes` 
                            : `${settings.reminderDaysBefore.join(', ')} dias antes`} do vencimento
                        </>
                      ) : (
                        "Selecione ao menos um dia para receber lembretes"
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    * Os lembretes são cancelados automaticamente se o boleto for pago antes da data
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Notificações de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="payment-notifications" className="text-base font-medium">
                    Notificar Pagamentos Realizados
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receba notificação por e-mail e WhatsApp quando um boleto for pago
                  </p>
                </div>
                <Switch
                  id="payment-notifications"
                  checked={settings.paymentNotificationsEnabled}
                  onCheckedChange={(checked) => {
                    const updatedSettings = { ...settings, paymentNotificationsEnabled: checked };
                    saveSettings(updatedSettings);
                  }}
                />
              </div>
              
              {settings.paymentNotificationsEnabled && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600">
                      Notificações de pagamento ativadas
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    As notificações incluirão: nome do boleto, categoria, valor pago e data do pagamento
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-primary" />
                Ações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1 pr-4">
                  <Label className="text-base font-medium">Enviar lembretes de hoje</Label>
                  <p className="text-sm text-muted-foreground">
                    Dispara manualmente o endpoint e usa suas preferências atuais
                  </p>
                </div>
                <Button onClick={handleSendReminders} disabled={sendingReminders || !settings.notificationsEnabled}>
                  {sendingReminders ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <BellRing className="h-4 w-4 mr-2" />
                  )}
                  {sendingReminders ? "Enviando..." : "Enviar lembretes agora"}
                </Button>
              </div>
              {!settings.notificationsEnabled && (
                <p className="text-xs text-muted-foreground">
                  Ative as notificações gerais para habilitar esta ação.
                </p>
              )}
            </CardContent>
          </Card>

          {/* AI API Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Configuração da IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-provider">Provedor de IA</Label>
                <Select
                  value={settings.aiProvider}
                  onValueChange={(value: AIProvider) => {
                    const updatedSettings = { ...settings, aiProvider: value };
                    saveSettings(updatedSettings);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o provedor de IA" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AI_PROVIDERS).map(([key, provider]) => (
                      <SelectItem key={key} value={key}>
                        {provider.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Escolha o provedor de IA para análise automática de boletos
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key">
                  Chave da API - {AI_PROVIDERS[settings.aiProvider].displayName}
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      id="api-key"
                      type="password"
                      placeholder={`Insira sua chave da API ${AI_PROVIDERS[settings.aiProvider].displayName}`}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" className="shrink-0">
                    <Key className="h-4 w-4 mr-1" />
                    Validar
                  </Button>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Configure sua chave de API para análise automática de boletos usando {AI_PROVIDERS[settings.aiProvider].displayName}.
                  </p>
                  {settings.aiProvider === 'openai' && (
                    <p className="text-xs text-blue-600">
                      🔗 Obtenha sua chave em: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">platform.openai.com/api-keys</a>
                    </p>
                  )}
                  {settings.aiProvider === 'gemini' && (
                    <p className="text-xs text-blue-600">
                      🔗 Obtenha sua chave em: <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">makersuite.google.com/app/apikey</a>
                    </p>
                  )}
                  {settings.aiProvider === 'claude' && (
                    <p className="text-xs text-blue-600">
                      🔗 Obtenha sua chave em: <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="underline">console.anthropic.com</a>
                    </p>
                  )}
                </div>
              </div>

              {apiKey && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600">
                      Chave da API {AI_PROVIDERS[settings.aiProvider].displayName} configurada
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      Ativa
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} size="lg" className="min-w-[200px]">
              <Save className="h-4 w-4 mr-2" />
              Salvar Alterações
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;