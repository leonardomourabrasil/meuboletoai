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
  const [lastRun, setLastRun] = useState<null | { date?: string; usersProcessed?: number; emailsSent?: number; whatsappsSent?: number; at: string }>(null);

  // Atualizar apiKey quando settings mudarem
  useEffect(() => {
    setApiKey(settings.aiApiKey || "");
  }, [settings]);

  // Carregar status da última execução
  useEffect(() => {
    try {
      const raw = localStorage.getItem("reminders-last-run");
      if (raw) setLastRun(JSON.parse(raw));
    } catch {}
  }, []);

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
          title: data?.message || "Lembretes enviados",
          description: `Usuários: ${users} • E-mails: ${emails} • WhatsApp: ${whats}`,
        });
        const info = { date: data?.date, usersProcessed: users, emailsSent: emails, whatsappsSent: whats, at: new Date().toISOString() };
        setLastRun(info);
        try { localStorage.setItem("reminders-last-run", JSON.stringify(info)); } catch {}
      } else if (resp.status === 404) {
        toast({
          variant: "destructive",
          title: "Endpoint indisponível",
          description: "No modo de desenvolvimento Vite, as rotas /api não estão ativas. Rode 'vercel dev' ou teste após o deploy.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao enviar lembretes",
          description: data?.error || "Tente novamente mais tarde.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao enviar lembretes",
        description: "Tente novamente mais tarde.",
      });
    } finally {
      setSendingReminders(false);
    }
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

  // Alterar janela de próximos vencimentos (Dashboard)
  const handleUpcomingWindowChange = (days: number) => {
    const updatedSettings: UserSettings = {
      ...settings,
      upcomingWindowDays: days,
    };
    saveSettings(updatedSettings);
  };

  // Novas funções para restaurar seções
  const handleProviderChange = (value: string) => {
    const updatedSettings: UserSettings = {
      ...settings,
      aiProvider: value as AIProvider,
    };
    saveSettings(updatedSettings);
  };

  const addEmailRecipient = () => {
    const email = newEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({ variant: "destructive", title: "E-mail inválido", description: "Informe um e-mail válido." });
      return;
    }
    if (settings.emailRecipients.some((r) => r.email.toLowerCase() === email.toLowerCase())) {
      toast({ title: "E-mail já adicionado", description: email });
      return;
    }
    const updatedSettings: UserSettings = {
      ...settings,
      emailRecipients: [...settings.emailRecipients, { id: email, email }],
    };
    saveSettings(updatedSettings);
    setNewEmail("");
  };

  const removeEmailRecipient = (id: string) => {
    const updatedSettings: UserSettings = {
      ...settings,
      emailRecipients: settings.emailRecipients.filter((r) => r.id !== id),
    };
    saveSettings(updatedSettings);
  };

  const addWhatsAppContact = () => {
    const name = newContactName.trim();
    const phone = newContactPhone.trim();
    const digits = phone.replace(/\D/g, "");
    if (!name) {
      toast({ variant: "destructive", title: "Nome obrigatório", description: "Informe o nome do contato." });
      return;
    }
    if (digits.length < 10) {
      toast({ variant: "destructive", title: "Telefone inválido", description: "Informe um telefone válido (DDD + número)." });
      return;
    }
    if (settings.whatsappContacts.some((c) => c.phone.replace(/\D/g, "") === digits)) {
      toast({ title: "Contato já adicionado", description: phone });
      return;
    }
    const updatedSettings: UserSettings = {
      ...settings,
      whatsappContacts: [...settings.whatsappContacts, { id: digits, name, phone }],
    };
    saveSettings(updatedSettings);
    setNewContactName("");
    setNewContactPhone("");
  };

  const removeWhatsAppContact = (id: string) => {
    const updatedSettings: UserSettings = {
      ...settings,
      whatsappContacts: settings.whatsappContacts.filter((c) => c.id !== id),
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
                <div className="space-y-1 pr-4">
                  <Label className="text-base font-medium">Ativar notificações</Label>
                  <p className="text-sm text-muted-foreground">Controla todos os lembretes e envios</p>
                </div>
                <Switch checked={settings.notificationsEnabled} onCheckedChange={(v) => saveSettings({ ...settings, notificationsEnabled: v })} />
              </div>
            </CardContent>
          </Card>

          {/* Notificações de Pagamento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Notificações de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1 pr-4">
                  <Label className="text-base font-medium">Alertas de pagamento realizado</Label>
                  <p className="text-sm text-muted-foreground">Receba confirmação quando um boleto for marcado como pago</p>
                </div>
                <Switch
                  checked={settings.paymentNotificationsEnabled}
                  onCheckedChange={(v) => saveSettings({ ...settings, paymentNotificationsEnabled: v })}
                  disabled={!settings.notificationsEnabled}
                />
              </div>
            </CardContent>
          </Card>

          {/* Integração com IA */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Integração com IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Provedor</Label>
                  <Select value={settings.aiProvider} onValueChange={handleProviderChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o provedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(AI_PROVIDERS).map((p) => (
                        <SelectItem key={p.name} value={p.name}>
                          {p.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Chave da API</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Cole sua chave da API"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      disabled={!settings.notificationsEnabled}
                    />
                    <Button onClick={handleSaveSettings} disabled={!settings.notificationsEnabled}>
                      <Key className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Sua chave é salva apenas no seu navegador ou na sua conta, nunca é exposta no código.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Destinatários de E-mail */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Destinatários de E-mail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="exemplo@dominio.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={!settings.notificationsEnabled}
                />
                <Button onClick={addEmailRecipient} disabled={!settings.notificationsEnabled || !newEmail.trim()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>

              <div className="space-y-2">
                {settings.emailRecipients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum e-mail adicionado.</p>
                ) : (
                  <div className="space-y-2">
                    {settings.emailRecipients.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-md border border-border p-2">
                        <span className="text-sm">{r.email}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeEmailRecipient(r.id)} disabled={!settings.notificationsEnabled}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contatos de WhatsApp */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Contatos de WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input
                  placeholder="Nome"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  disabled={!settings.notificationsEnabled}
                />
                <Input
                  placeholder="(11) 91234-5678"
                  value={newContactPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  disabled={!settings.notificationsEnabled}
                />
                <Button onClick={addWhatsAppContact} disabled={!settings.notificationsEnabled || !newContactName.trim() || !newContactPhone.trim()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>

              <div className="space-y-2">
                {settings.whatsappContacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum contato adicionado.</p>
                ) : (
                  <div className="space-y-2">
                    {settings.whatsappContacts.map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-md border border-border p-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{c.name}</span>
                          <span className="text-xs text-muted-foreground">{c.phone}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeWhatsAppContact(c.id)} disabled={!settings.notificationsEnabled}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

                <Separator className="my-4" />
                <div className="space-y-3">
                  <div>
                    <Label className="text-base font-medium">
                      Janela para "Próximos Vencimentos" (Dashboard)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Defina quantos dias considerar ao mostrar os próximos vencimentos no painel
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[3, 7, 14, 30].map((days) => (
                      <Button
                        key={days}
                        variant={settings.upcomingWindowDays === days ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleUpcomingWindowChange(days)}
                        className="w-full"
                      >
                        {days} dias
                      </Button>
                    ))}
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">
                        Atualmente configurado para {settings.upcomingWindowDays} dia{settings.upcomingWindowDays > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />
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
              {lastRun && (
                <div className="p-3 bg-muted/30 rounded-lg text-sm">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span><strong>Última execução:</strong> {new Date(lastRun.at).toLocaleString()}</span>
                    {lastRun.date && <span><strong>Data alvo:</strong> {lastRun.date}</span>}
                    <span><strong>Usuários:</strong> {lastRun.usersProcessed ?? 0}</span>
                    <span><strong>E-mails:</strong> {lastRun.emailsSent ?? 0}</span>
                    <span><strong>WhatsApp:</strong> {lastRun.whatsappsSent ?? 0}</span>
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

// Helpers
function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}