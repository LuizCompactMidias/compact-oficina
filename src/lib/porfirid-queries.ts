import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const ORDER_STATUSES = [
  "recepcao",
  "diagnostico",
  "aguardando_aprovacao",
  "em_execucao",
  "finalizacao",
  "pronto_entrega",
  "entregue",
  "cancelada",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  recepcao: "Recepção",
  diagnostico: "Diagnóstico",
  aguardando_aprovacao: "Aguardando aprovação",
  em_execucao: "Em execução",
  finalizacao: "Finalização",
  pronto_entrega: "Pronto para entrega",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

export const OPEN_STATUSES: OrderStatus[] = [
  "recepcao",
  "diagnostico",
  "aguardando_aprovacao",
  "em_execucao",
  "finalizacao",
  "pronto_entrega",
];

export function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role, active")
        .eq("id", user.id)
        .maybeSingle();
      return { email: user.email ?? "", profile: data };
    },
  });
}

export function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [orders, customers, vehicles, appointments] = await Promise.all([
        supabase.from("work_orders").select("id, status, total, payment_status, entry_at"),
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("vehicles").select("id", { count: "exact", head: true }),
        supabase.from("appointments").select("id", { count: "exact", head: true }),
      ]);

      const rows = orders.data ?? [];
      const byStatus = ORDER_STATUSES.map((status) => ({
        status,
        count: rows.filter((row) => row.status === status).length,
      }));
      const open = rows.filter((row) => OPEN_STATUSES.includes(row.status as OrderStatus));
      const delivered = rows.filter((row) => row.status === "entregue");
      const revenue = delivered.reduce((sum, row) => sum + Number(row.total ?? 0), 0);

      return {
        totalOrders: rows.length,
        openOrders: open.length,
        readyForDelivery: rows.filter((row) => row.status === "pronto_entrega").length,
        awaitingApproval: rows.filter((row) => row.status === "aguardando_aprovacao").length,
        revenue,
        averageTicket: delivered.length ? revenue / delivered.length : 0,
        byStatus,
        customers: customers.count ?? 0,
        vehicles: vehicles.count ?? 0,
        appointments: appointments.count ?? 0,
      };
    },
  });
}

export function useRecentOrders() {
  return useQuery({
    queryKey: ["work_orders", "recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("work_orders")
        .select(
          "id, order_number, status, total, promised_at, customers(name), vehicles(brand, model, plate)",
        )
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });
}

export function useServiceCatalog() {
  return useQuery({
    queryKey: ["service_catalog"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_catalog")
        .select("*")
        .order("name", { ascending: true });
      return data ?? [];
    },
  });
}

export function useInventory() {
  return useQuery({
    queryKey: ["inventory_items"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return [];
      const { data: profile } = await supabase
        .from("profiles")
        .select("role,active")
        .eq("id", userId)
        .maybeSingle();
      if (!profile?.active) return [];
      if (profile.role === "atendimento") {
        const { data, error } = await supabase.rpc("get_frontdesk_inventory");
        if (error) throw error;
        return data ?? [];
      }
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name, phone, email, city, created_at")
        .order("name", { ascending: true });
      return data ?? [];
    },
  });
}

export function useVehicles() {
  return useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vehicles")
        .select("id, plate, brand, model, year, current_mileage, customers(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
}

export function useAppointments() {
  return useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status, notes, customers(name), vehicles(brand, model, plate), service_catalog(name)")
        .order("scheduled_at", { ascending: true })
        .limit(50);
      return data ?? [];
    },
  });
}

export function useFinance() {
  return useQuery({
    queryKey: ["finance"],
    queryFn: async () => {
      const [payments, expenses, orders] = await Promise.all([
        supabase.from("payments").select("amount, status, paid_at, method"),
        supabase.from("expenses").select("amount, status, due_date, description"),
        supabase.from("work_orders").select("total, payment_status"),
      ]);
      const pay = payments.data ?? [];
      const exp = expenses.data ?? [];
      const ord = orders.data ?? [];
      const received = pay
        .filter((p) => p.status === "confirmado")
        .reduce((s, p) => s + Number(p.amount ?? 0), 0);
      const toReceive = ord
        .filter((o) => o.payment_status !== "pago")
        .reduce((s, o) => s + Number(o.total ?? 0), 0);
      const paidExpenses = exp
        .filter((e) => e.status === "pago")
        .reduce((s, e) => s + Number(e.amount ?? 0), 0);
      const toPay = exp
        .filter((e) => e.status !== "pago")
        .reduce((s, e) => s + Number(e.amount ?? 0), 0);
      return { received, toReceive, paidExpenses, toPay, result: received - paidExpenses };
    },
  });
}