import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface UserSettings {
  notificationsEnabled: boolean;
  emailRecipients: Array<{ id: string; email: string }>;
  whatsappContacts: Array<{ id: string; name: string; phone: string }>;
  aiApiKey: string;
  aiProvider: 'openai' | 'gemini' | 'claude';
  reminderDaysBefore: number[];
  paymentNotificationsEnabled: boolean;
  upcomingWindowDays: number; // novo campo
}

const DEFAULT_SETTINGS: UserSettings = {
  notificationsEnabled: true,
  emailRecipients: [],
  whatsappContacts: [],
  aiApiKey: '', // Nunca comitar chaves; deixar vazio por padrão
  aiProvider: 'gemini', // Gemini como padrão
  reminderDaysBefore: [1],
  paymentNotificationsEnabled: true,
  upcomingWindowDays: 7, // default
};

export const useUserSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Widen type temporariamente para acessar tabelas recém-criadas sem tipos gerados
  const sb: any = supabase;

  // Função para obter chave única por usuário
  const getStorageKey = useCallback(() => {
    return user ? `meuboleto-settings-${user.id}` : 'meuboleto-settings';
  }, [user]);

  // Função para carregar configurações (tenta Supabase quando logado)
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const storageKey = getStorageKey();

      if (user) {
        const { data, error } = await sb
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (!error && data) {
          const normalized: UserSettings = {
            notificationsEnabled: data.notifications_enabled ?? DEFAULT_SETTINGS.notificationsEnabled,
            emailRecipients: Array.isArray(data.email_recipients)
              ? data.email_recipients.map((email: string) => ({ id: email, email }))
              : DEFAULT_SETTINGS.emailRecipients,
            whatsappContacts: Array.isArray(data.whatsapp_recipients)
              ? data.whatsapp_recipients.map((phone: string) => ({ id: phone, name: '', phone }))
              : DEFAULT_SETTINGS.whatsappContacts,
            aiApiKey: DEFAULT_SETTINGS.aiApiKey,
            aiProvider: DEFAULT_SETTINGS.aiProvider,
            reminderDaysBefore: Array.isArray(data.reminder_days) ? data.reminder_days : DEFAULT_SETTINGS.reminderDaysBefore,
            paymentNotificationsEnabled: DEFAULT_SETTINGS.paymentNotificationsEnabled,
            upcomingWindowDays: typeof data.upcoming_window_days === 'number' ? data.upcoming_window_days : DEFAULT_SETTINGS.upcomingWindowDays,
          };
          setSettings(normalized);
          localStorage.setItem(storageKey, JSON.stringify(normalized));
          setLoading(false);
          return;
        }
      }

      // Fallback: localStorage
      const savedSettings = localStorage.getItem(storageKey);
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          const normalized: UserSettings = {
            notificationsEnabled: parsed?.notificationsEnabled ?? DEFAULT_SETTINGS.notificationsEnabled,
            emailRecipients: Array.isArray(parsed?.emailRecipients) ? parsed.emailRecipients : DEFAULT_SETTINGS.emailRecipients,
            whatsappContacts: Array.isArray(parsed?.whatsappContacts) ? parsed.whatsappContacts : DEFAULT_SETTINGS.whatsappContacts,
            aiApiKey: parsed?.aiApiKey ?? DEFAULT_SETTINGS.aiApiKey,
            aiProvider: parsed?.aiProvider ?? DEFAULT_SETTINGS.aiProvider,
            reminderDaysBefore: Array.isArray(parsed?.reminderDaysBefore)
              ? parsed.reminderDaysBefore
              : typeof parsed?.reminderDaysBefore === 'number'
              ? [parsed.reminderDaysBefore]
              : DEFAULT_SETTINGS.reminderDaysBefore,
            paymentNotificationsEnabled: parsed?.paymentNotificationsEnabled ?? DEFAULT_SETTINGS.paymentNotificationsEnabled,
            upcomingWindowDays: typeof parsed?.upcomingWindowDays === 'number' ? parsed.upcomingWindowDays : DEFAULT_SETTINGS.upcomingWindowDays,
          };
          setSettings(normalized);
        } catch (e) {
          console.error('Erro ao carregar configurações:', e);
          setSettings(DEFAULT_SETTINGS);
        }
      } else {
        setSettings(DEFAULT_SETTINGS);
        localStorage.setItem(storageKey, JSON.stringify(DEFAULT_SETTINGS));
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, [getStorageKey, user]);

  // Função para salvar configurações (também persiste no Supabase quando logado)
  const saveSettings = async (newSettings: UserSettings) => {
    try {
      const storageKey = getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(newSettings));
      setSettings(newSettings);

      if (user) {
        const payload = {
          user_id: user.id,
          notifications_enabled: newSettings.notificationsEnabled,
          email_recipients: newSettings.emailRecipients.map((r) => r.email),
          whatsapp_recipients: newSettings.whatsappContacts.map((c) => c.phone),
          reminder_days: newSettings.reminderDaysBefore,
          upcoming_window_days: newSettings.upcomingWindowDays,
        };

        const { error } = await sb
          .from('user_settings')
          .upsert(payload, { onConflict: 'user_id' });

        if (error) {
          console.error('Erro ao salvar user_settings no Supabase:', error);
        }
      }

      toast({
        title: 'Configurações salvas',
        description: user ? 'Suas configurações foram salvas para sua conta.' : 'Suas configurações foram salvas localmente.',
      });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar suas configurações',
        variant: 'destructive',
      });
    }
  };

  // Carregar configurações quando o usuário mudar ou componente montar
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    loading,
    saveSettings,
    loadSettings,
  };
};