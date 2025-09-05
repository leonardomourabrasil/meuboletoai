import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface UserSettings {
  notificationsEnabled: boolean;
  emailRecipients: Array<{ id: string; email: string }>;
  whatsappContacts: Array<{ id: string; name: string; phone: string }>;
  aiApiKey: string;
  aiProvider: 'openai' | 'gemini' | 'claude';
  reminderDaysBefore: number[];
  paymentNotificationsEnabled: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  notificationsEnabled: true,
  emailRecipients: [],
  whatsappContacts: [],
  aiApiKey: "AIzaSyCwZnmmxtKyD0k2fxh1vuo8IfdAKBKQPNQ", // Chave padrão do Gemini
  aiProvider: 'gemini', // Gemini como padrão
  reminderDaysBefore: [1],
  paymentNotificationsEnabled: true
};

export const useUserSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Função para obter chave única por usuário
  const getStorageKey = useCallback(() => {
    return user ? `meuboleto-settings-${user.id}` : 'meuboleto-settings';
  }, [user]);

  // Função para carregar configurações do localStorage com chave específica do usuário
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const storageKey = getStorageKey();
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
              : typeof parsed?.reminderDaysBefore === "number"
              ? [parsed.reminderDaysBefore]
              : DEFAULT_SETTINGS.reminderDaysBefore,
            paymentNotificationsEnabled: parsed?.paymentNotificationsEnabled ?? DEFAULT_SETTINGS.paymentNotificationsEnabled,
          };
          setSettings(normalized);
        } catch (e) {
          console.error('Erro ao carregar configurações:', e);
          setSettings(DEFAULT_SETTINGS);
        }
      } else {
        // Para usuários novos ou sem configurações salvas
        setSettings(DEFAULT_SETTINGS);
        // Salvar configurações padrão imediatamente
        localStorage.setItem(storageKey, JSON.stringify(DEFAULT_SETTINGS));
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, [getStorageKey]);

  // Função para salvar configurações com chave específica do usuário
  const saveSettings = async (newSettings: UserSettings) => {
    try {
      const storageKey = getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(newSettings));
      setSettings(newSettings);
      
      toast({
        title: "Configurações salvas",
        description: user 
          ? "Suas configurações foram salvas para sua conta." 
          : "Suas configurações foram salvas localmente.",
      });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar suas configurações",
        variant: "destructive"
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
    loadSettings
  };
};