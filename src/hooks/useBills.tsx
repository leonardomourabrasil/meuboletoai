import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Bill {
  id: string;
  title: string;
  amount: number;
  due_date: string;
  paid: boolean;
  category?: string;
  barcode?: string;
  description?: string;
  payment_method?: string;
  discount?: number;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}

export interface BillForDisplay {
  id: string;
  beneficiary: string;
  amount: number;
  dueDate: string;
  status: "pending" | "paid";
  category?: string;
  barcode?: string;
  paymentMethod?: "PIX" | "Cartão de Crédito" | "Transferência Bancária";
  discount?: number;
  paidAt?: string;
}

export const useBills = () => {
  const [bills, setBills] = useState<BillForDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  // Converter dados do Supabase para formato de exibição
  const convertToDisplayFormat = (bill: Bill): BillForDisplay => ({
    id: bill.id,
    beneficiary: bill.title,
    amount: bill.amount,
    dueDate: bill.due_date,
    status: bill.paid ? "paid" : "pending",
    category: bill.category,
    barcode: bill.barcode,
    paymentMethod: bill.payment_method as any,
    discount: bill.discount || 0,
    paidAt: bill.paid ? bill.updated_at?.split('T')[0] : undefined
  });

  // Converter dados de exibição para formato do Supabase
  const convertToSupabaseFormat = (bill: Omit<BillForDisplay, "id" | "status">): Omit<Bill, "id" | "created_at" | "updated_at" | "user_id"> => ({
    title: bill.beneficiary,
    amount: bill.amount,
    due_date: bill.dueDate,
    paid: false,
    category: bill.category,
    barcode: bill.barcode,
    payment_method: bill.paymentMethod,
    discount: bill.discount || 0
  });

  // Carregar boletos do usuário
  const loadBills = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true });

      if (error) {
        console.error('Erro ao carregar boletos:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os boletos",
          variant: "destructive"
        });
        return;
      }

      const displayBills = data.map(convertToDisplayFormat);
      setBills(displayBills);
    } catch (error) {
      console.error('Erro ao carregar boletos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os boletos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Adicionar novo boleto
  const addBill = async (newBill: Omit<BillForDisplay, "id" | "status">) => {
    if (!user) return;

    try {
      const supabaseBill = convertToSupabaseFormat(newBill);
      const { data, error } = await supabase
        .from('bills')
        .insert([{ ...supabaseBill, user_id: user.id }])
        .select()
        .single();

      if (error) {
        console.error('Erro ao adicionar boleto:', error);
        toast({
          title: "Erro",
          description: "Não foi possível adicionar o boleto",
          variant: "destructive"
        });
        return;
      }

      const displayBill = convertToDisplayFormat(data);
      setBills(prev => [...prev, displayBill]);
      
      toast({
        title: "Sucesso",
        description: "Boleto adicionado com sucesso"
      });
    } catch (error) {
      console.error('Erro ao adicionar boleto:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o boleto",
        variant: "destructive"
      });
    }
  };

  // Atualizar status do boleto
  const updateBillStatus = async (billId: string, newStatus: "pending" | "paid", paymentMethod?: string) => {
    if (!user) return;

    try {
      const updateData: any = {
        paid: newStatus === "paid",
        updated_at: new Date().toISOString()
      };

      if (newStatus === "paid" && paymentMethod) {
        updateData.payment_method = paymentMethod;
      } else if (newStatus === "pending") {
        updateData.payment_method = null;
      }

      const { data, error } = await supabase
        .from('bills')
        .update(updateData)
        .eq('id', billId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar boleto:', error);
        toast({
          title: "Erro",
          description: "Não foi possível atualizar o boleto",
          variant: "destructive"
        });
        return;
      }

      const displayBill = convertToDisplayFormat(data);
      setBills(prev => prev.map(bill => 
        bill.id === billId ? displayBill : bill
      ));

      toast({
        title: "Sucesso",
        description: `Boleto marcado como ${newStatus === "paid" ? "pago" : "pendente"}`
      });
    } catch (error) {
      console.error('Erro ao atualizar boleto:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o boleto",
        variant: "destructive"
      });
    }
  };

  // Deletar boleto
  const deleteBill = async (billId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('bills')
        .delete()
        .eq('id', billId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Erro ao deletar boleto:', error);
        toast({
          title: "Erro",
          description: "Não foi possível deletar o boleto",
          variant: "destructive"
        });
        return;
      }

      setBills(prev => prev.filter(bill => bill.id !== billId));
      
      toast({
        title: "Sucesso",
        description: "Boleto deletado com sucesso"
      });
    } catch (error) {
      console.error('Erro ao deletar boleto:', error);
      toast({
        title: "Erro",
        description: "Não foi possível deletar o boleto",
        variant: "destructive"
      });
    }
  };

  // Configurar realtime para sincronização automática
  useEffect(() => {
    if (!user) return;

    loadBills();

    // Configurar realtime para atualizações automáticas
    const channel = supabase
      .channel('bills-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bills',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Realtime update:', payload);
          // Recarregar dados quando houver mudanças
          loadBills();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    bills,
    loading,
    addBill,
    updateBillStatus,
    deleteBill,
    loadBills
  };
};