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
  paid_at?: string; // NOVO: data real do pagamento
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
    // Fallback para dados antigos: se está pago mas sem paid_at, usar updated_at; senão due_date
    paidAt: bill.paid_at ?? (bill.paid ? (bill.updated_at ?? bill.due_date) : undefined)
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
        const message = (error as any)?.message?.includes('discount')
          ? 'Não foi possível adicionar o boleto: coluna "discount" não existe no banco. Aplique a migration de schema.'
          : `Não foi possível adicionar o boleto${(error as any)?.message ? `: ${(error as any).message}` : ''}`;
        toast({
          title: "Erro",
          description: message,
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
        description: error instanceof Error ? `Não foi possível adicionar o boleto: ${error.message}` : "Não foi possível adicionar o boleto",
        variant: "destructive"
      });
    }
  };

  // NOVO: Adicionar boleto retroativo (já pago, com paid_at definido)
  const addRetroBill = async (retroBill: Omit<BillForDisplay, "id" | "status"> & { paidAt: string }) => {
    if (!user) return;

    try {
      const baseBill: any = {
        title: retroBill.beneficiary,
        amount: retroBill.amount,
        due_date: retroBill.dueDate,
        paid: true,
        category: retroBill.category,
        barcode: retroBill.barcode,
        payment_method: retroBill.paymentMethod,
      };

      // Monta payload inicial com paid_at e discount
      let insertPayload: any = { ...baseBill, discount: retroBill.discount || 0, paid_at: retroBill.paidAt };

      const attemptInsert = async (payload: any) => {
        return await supabase
          .from('bills')
          .insert([{ ...payload, user_id: user.id }])
          .select()
          .single();
      };

      // 1ª tentativa
      let { data, error } = await attemptInsert(insertPayload);

      let removedPaidAt = false;
      let removedDiscount = false;

      if (error) {
        console.error('Erro ao adicionar boleto retroativo (tentativa 1):', error);

        // Fallback 1: remover paid_at se existir no payload
        if ('paid_at' in insertPayload) {
          delete insertPayload.paid_at;
          removedPaidAt = true;
          ({ data, error } = await attemptInsert(insertPayload));
        }

        // Fallback 2: ainda falhou? remover discount também
        if (error && 'discount' in insertPayload) {
          delete insertPayload.discount;
          removedDiscount = true;
          ({ data, error } = await attemptInsert(insertPayload));
        }

        if (error) {
          const message = (error as any)?.message ? `: ${(error as any).message}` : '';
          toast({
            title: "Erro",
            description: `Não foi possível adicionar o boleto retroativo${message}`,
            variant: "destructive"
          });
          return;
        }

        // Avisos após fallbacks aplicados
        if (removedPaidAt) {
          toast({
            title: "Aviso",
            description: "A coluna 'paid_at' não foi encontrada no banco. O lançamento foi salvo, mas a data real de pagamento será inferida por 'updated_at'.",
          });
        }
        if (removedDiscount) {
          toast({
            title: "Aviso",
            description: "A coluna 'discount' não foi encontrada no banco. O lançamento foi salvo sem desconto.",
          });
        }
      }

      if (!data) return;

      const displayBill = convertToDisplayFormat(data);
      setBills(prev => [...prev, displayBill]);

      toast({
        title: "Sucesso",
        description: "Boleto retroativo adicionado como pago"
      });
    } catch (error) {
      console.error('Erro ao adicionar boleto retroativo:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? `Não foi possível adicionar o boleto retroativo: ${error.message}` : "Não foi possível adicionar o boleto retroativo",
        variant: "destructive"
      });
    }
  };

  // Atualizar status do boleto
  const updateBillStatus = async (billId: string, newStatus: "pending" | "paid", paymentMethod?: string) => {
    if (!user) return;

    try {
      const updateData: any = {
        paid: newStatus === "paid", // não forçar updated_at; trigger no BD cuidará
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
    addRetroBill, // NOVO
    updateBillStatus,
    deleteBill,
    loadBills
  };
};