import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import twilio from 'twilio';
import { format } from 'date-fns';

type Reminder = {
  id: string;
  user_id: string;
  bill_id: string;
  send_email: boolean;
  send_whatsapp: boolean;
};

type Bill = {
  id: string;
  title: string;
  amount: number;
  due_date: string;
};

type UserSettings = {
  notifications_enabled: boolean;
  email_recipients: string[];
  whatsapp_recipients: string[];
  reminder_days: number[];
};

function assertEnv(name: string, value?: string) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const SUPABASE_URL = assertEnv('SUPABASE_URL', process.env.SUPABASE_URL);
    const SUPABASE_SERVICE_ROLE_KEY = assertEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Providers opcionais
    const EMAIL_FROM = process.env.EMAIL_FROM || 'MeuBoletoAI <contato@solospeak.com.br>';
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
    const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
    const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
    const twilioClient = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    // 1) Get today's reminders not sent
    const { data: reminders, error: remErr } = await supabase
      .from('reminders')
      .select('id,user_id,bill_id,send_email,send_whatsapp')
      .eq('remind_date', todayStr)
      .is('sent_at', null);

    if (remErr) throw remErr;

    if (!reminders || reminders.length === 0) {
      return res.status(200).json({ ok: true, message: 'No reminders for today', date: todayStr });
    }

    // Group by user
    const byUser = new Map<string, Reminder[]>();
    for (const r of reminders as Reminder[]) {
      if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
      byUser.get(r.user_id)!.push(r);
    }

    let usersProcessed = 0;
    let emailsSent = 0;
    let whatsappsSent = 0;

    for (const [userId, userReminders] of byUser.entries()) {
      // 2) Load user settings
      const { data: sett, error: settErr } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (settErr || !sett) {
        console.warn('Missing settings for user', userId, settErr);
        continue;
      }

      const s = sett as UserSettings;
      if (!s.notifications_enabled) continue;

      // 3) Load bills
      const billIds = Array.from(new Set(userReminders.map((r) => r.bill_id)));
      const { data: bills, error: billsErr } = await supabase
        .from('bills')
        .select('id,title,amount,due_date')
        .in('id', billIds);

      if (billsErr || !bills) {
        console.error('Bills fetch error', userId, billsErr);
        continue;
      }

      const html = `
        <div style="font-family: Arial, sans-serif; line-height:1.5">
          <h2>Contas a vencer</h2>
          <p>Você tem ${bills.length} conta(s) se aproximando do vencimento:</p>
          <ul>
            ${bills
              .map(
                (b: Bill) =>
                  `<li><strong>${b.title}</strong> - R$ ${Number(b.amount).toFixed(2)} - Vence em ${format(
                    new Date(b.due_date + 'T00:00:00'),
                    'dd/MM/yyyy'
                  )}</li>`
              )
              .join('')}
          </ul>
          <p>Este é um lembrete automático do MeuBoletoAI.</p>
        </div>
      `.trim();

      const whatsappBody = [
        `Você tem ${bills.length} conta(s) a vencer:`,
        ...bills.map(
          (b: Bill) =>
            `• ${b.title} - R$ ${Number(b.amount).toFixed(2)} - vence em ${format(
              new Date(b.due_date + 'T00:00:00'),
              'dd/MM/yyyy'
            )}`
        ),
      ].join('\n');

      let sentSomething = false;

      const wantsEmail = resend && EMAIL_FROM && userReminders.some((r) => r.send_email);
      if (wantsEmail && Array.isArray(s.email_recipients) && s.email_recipients.length > 0) {
        try {
          const { error } = await resend!.emails.send({
            from: EMAIL_FROM,
            to: s.email_recipients,
            subject: `Lembrete: ${bills.length} conta(s) a vencer`,
            html,
          });
          if (error) {
            console.error('Resend error for user', userId, error);
          } else {
            emailsSent += s.email_recipients.length;
            sentSomething = true;
          }
        } catch (e) {
          console.error('Resend exception for user', userId, e);
        }
      }

      const wantsWhatsapp = twilioClient && TWILIO_WHATSAPP_FROM && userReminders.some((r) => r.send_whatsapp);
      if (wantsWhatsapp && Array.isArray(s.whatsapp_recipients) && s.whatsapp_recipients.length > 0) {
        for (const toRaw of s.whatsapp_recipients) {
          const to = toRaw.startsWith('whatsapp:') ? toRaw : `whatsapp:${toRaw}`;
          try {
            await twilioClient!.messages.create({
              from: TWILIO_WHATSAPP_FROM,
              to,
              body: whatsappBody,
            });
            whatsappsSent += 1;
            sentSomething = true;
          } catch (e) {
            console.error('Twilio WhatsApp error for user', userId, to, e);
          }
        }
      }

      if (sentSomething) {
        const remIds = userReminders.map((r) => r.id);
        const { error: updErr } = await supabase
          .from('reminders')
          .update({ sent_at: new Date().toISOString() })
          .in('id', remIds);
        if (updErr) {
          console.error('Failed to update reminders sent_at', userId, updErr);
        } else {
          usersProcessed += 1;
        }
      }
    }

    return res.status(200).json({
      ok: true,
      usersProcessed,
      emailsSent,
      whatsappsSent,
      date: todayStr,
    });
  } catch (err: any) {
    console.error('send-reminders error:', err);
    return res.status(500).json({ error: err?.message || 'Internal Error' });
  }
}

export const config = {
  runtime: 'nodejs',
};