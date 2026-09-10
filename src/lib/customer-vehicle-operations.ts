import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

function asError(error: unknown, fallback: string) {
  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? fallback);
    if (message.includes("vehicles_plate_key")) return new Error("Já existe um veículo cadastrado com esta placa.");
    if (message.includes("customers_cpf_cnpj")) return new Error("Já existe um cliente cadastrado com este CPF/CNPJ.");
    if (message.includes("foreign key constraint")) return new Error("Este cadastro possui histórico vinculado e não pode ser excluído.");
    return new Error(message);
  }
  return new Error(fallback);
}

function blankToNull(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

export type CustomerInput = {
  name: string;
  cpf_cnpj?: string | null;
  phone: string;
  email?: string | null;
  cep?: string | null;
  address?: string | null;
  address_number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
};

export type VehicleInput = {
  customer_id: string;
  plate: string;
  vin?: string | null;
  brand: string;
  model: string;
  version?: string | null;
  year?: number | string | null;
  model_year?: number | string | null;
  color?: string | null;
  fuel?: string | null;
  current_mileage?: number | string | null;
  notes?: string | null;
};

export function useCustomerDirectory() {
  return useQuery({
    queryKey: ["customer_directory"],
    queryFn: async () => {
      const [customersResult, vehiclesResult, ordersResult, appointmentsResult] = await Promise.all([
        db.from("customers").select("*").order("name", { ascending: true }),
        db.from("vehicles").select("id, customer_id"),
        db.from("work_orders").select("id, customer_id, status"),
        db.from("appointments").select("id, customer_id, status"),
      ]);
      const error = customersResult.error || vehiclesResult.error || ordersResult.error || appointmentsResult.error;
      if (error) throw asError(error, "Não foi possível carregar os clientes.");
      return (customersResult.data ?? []).map((customer: any) => ({
        ...customer,
        vehicle_count: (vehiclesResult.data ?? []).filter((row: any) => row.customer_id === customer.id).length,
        order_count: (ordersResult.data ?? []).filter((row: any) => row.customer_id === customer.id).length,
        appointment_count: (appointmentsResult.data ?? []).filter((row: any) => row.customer_id === customer.id).length,
      }));
    },
  });
}

export function useVehicleDirectory() {
  return useQuery({
    queryKey: ["vehicle_directory"],
    queryFn: async () => {
      const [vehiclesResult, ordersResult, appointmentsResult] = await Promise.all([
        db.from("vehicles").select("*, customers(id, name, phone)").order("created_at", { ascending: false }),
        db.from("work_orders").select("id, vehicle_id, status"),
        db.from("appointments").select("id, vehicle_id, status"),
      ]);
      const error = vehiclesResult.error || ordersResult.error || appointmentsResult.error;
      if (error) throw asError(error, "Não foi possível carregar os veículos.");
      return (vehiclesResult.data ?? []).map((vehicle: any) => ({
        ...vehicle,
        order_count: (ordersResult.data ?? []).filter((row: any) => row.vehicle_id === vehicle.id).length,
        appointment_count: (appointmentsResult.data ?? []).filter((row: any) => row.vehicle_id === vehicle.id).length,
      }));
    },
  });
}

export function useCustomerHistory(customerId: string | null) {
  return useQuery({
    queryKey: ["customer_history", customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      if (!customerId) return null;
      const [customerResult, vehiclesResult, ordersResult, appointmentsResult] = await Promise.all([
        db.from("customers").select("*").eq("id", customerId).single(),
        db.from("vehicles").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
        db.from("work_orders").select("id, order_number, status, total, entry_at, promised_at, vehicles(brand, model, plate)").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(30),
        db.from("appointments").select("id, scheduled_at, status, notes, vehicles(brand, model, plate), service_catalog(name)").eq("customer_id", customerId).order("scheduled_at", { ascending: false }).limit(30),
      ]);
      const error = customerResult.error || vehiclesResult.error || ordersResult.error || appointmentsResult.error;
      if (error) throw asError(error, "Não foi possível carregar o histórico do cliente.");
      return { customer: customerResult.data, vehicles: vehiclesResult.data ?? [], orders: ordersResult.data ?? [], appointments: appointmentsResult.data ?? [] };
    },
  });
}

export function useVehicleHistory(vehicleId: string | null) {
  return useQuery({
    queryKey: ["vehicle_history", vehicleId],
    enabled: Boolean(vehicleId),
    queryFn: async () => {
      if (!vehicleId) return null;
      const [vehicleResult, ordersResult, appointmentsResult] = await Promise.all([
        db.from("vehicles").select("*, customers(id, name, phone, email)").eq("id", vehicleId).single(),
        db.from("work_orders").select("id, order_number, status, total, entry_at, promised_at, mileage_in, customer_report, diagnosis, customers(name)").eq("vehicle_id", vehicleId).order("created_at", { ascending: false }).limit(40),
        db.from("appointments").select("id, scheduled_at, status, notes, service_catalog(name)").eq("vehicle_id", vehicleId).order("scheduled_at", { ascending: false }).limit(30),
      ]);
      const error = vehicleResult.error || ordersResult.error || appointmentsResult.error;
      if (error) throw asError(error, "Não foi possível carregar o histórico do veículo.");
      return { vehicle: vehicleResult.data, orders: ordersResult.data ?? [], appointments: appointmentsResult.data ?? [] };
    },
  });
}

export async function createCustomer(input: CustomerInput) {
  if (!input.name.trim() || !input.phone.trim()) throw new Error("Informe nome e telefone do cliente.");
  const payload = {
    name: input.name.trim(), cpf_cnpj: blankToNull(input.cpf_cnpj), phone: input.phone.trim(), email: blankToNull(input.email),
    cep: blankToNull(input.cep), address: blankToNull(input.address), address_number: blankToNull(input.address_number), neighborhood: blankToNull(input.neighborhood),
    city: blankToNull(input.city), state: blankToNull(input.state)?.toUpperCase() ?? null, notes: blankToNull(input.notes),
  };
  const { data, error } = await db.from("customers").insert(payload).select("*").single();
  if (error) throw asError(error, "Não foi possível cadastrar o cliente.");
  return data;
}

export async function updateCustomer(customerId: string, input: CustomerInput) {
  if (!input.name.trim() || !input.phone.trim()) throw new Error("Informe nome e telefone do cliente.");
  const payload = {
    name: input.name.trim(), cpf_cnpj: blankToNull(input.cpf_cnpj), phone: input.phone.trim(), email: blankToNull(input.email),
    cep: blankToNull(input.cep), address: blankToNull(input.address), address_number: blankToNull(input.address_number), neighborhood: blankToNull(input.neighborhood),
    city: blankToNull(input.city), state: blankToNull(input.state)?.toUpperCase() ?? null, notes: blankToNull(input.notes), updated_at: new Date().toISOString(),
  };
  const { data, error } = await db.from("customers").update(payload).eq("id", customerId).select("*").single();
  if (error) throw asError(error, "Não foi possível atualizar o cliente.");
  return data;
}

export async function deleteCustomer(customerId: string) {
  const [vehicles, orders, appointments] = await Promise.all([
    db.from("vehicles").select("id", { count: "exact", head: true }).eq("customer_id", customerId),
    db.from("work_orders").select("id", { count: "exact", head: true }).eq("customer_id", customerId),
    db.from("appointments").select("id", { count: "exact", head: true }).eq("customer_id", customerId),
  ]);
  if ((vehicles.count ?? 0) > 0 || (orders.count ?? 0) > 0 || (appointments.count ?? 0) > 0) throw new Error("Este cliente possui veículo, OS ou agendamento vinculado. Preserve o cadastro para manter o histórico.");
  const { error } = await db.from("customers").delete().eq("id", customerId);
  if (error) throw asError(error, "Não foi possível excluir o cliente.");
}

function normalizeVehicle(input: VehicleInput) {
  const toInteger = (value: number | string | null | undefined) => { const text = String(value ?? "").trim(); if (!text) return null; const parsed = Number.parseInt(text, 10); return Number.isFinite(parsed) ? parsed : null; };
  return {
    customer_id: input.customer_id, plate: input.plate.trim().toUpperCase(), vin: blankToNull(input.vin), brand: input.brand.trim(), model: input.model.trim(), version: blankToNull(input.version),
    year: toInteger(input.year), model_year: toInteger(input.model_year), color: blankToNull(input.color), fuel: blankToNull(input.fuel), current_mileage: toInteger(input.current_mileage), notes: blankToNull(input.notes),
  };
}

export async function createVehicle(input: VehicleInput) {
  if (!input.customer_id) throw new Error("Selecione o proprietário do veículo.");
  if (!input.plate.trim() || !input.brand.trim() || !input.model.trim()) throw new Error("Informe placa, marca e modelo.");
  const { data, error } = await db.from("vehicles").insert(normalizeVehicle(input)).select("*, customers(id, name, phone)").single();
  if (error) throw asError(error, "Não foi possível cadastrar o veículo.");
  return data;
}

export async function updateVehicle(vehicleId: string, input: VehicleInput) {
  if (!input.customer_id) throw new Error("Selecione o proprietário do veículo.");
  if (!input.plate.trim() || !input.brand.trim() || !input.model.trim()) throw new Error("Informe placa, marca e modelo.");
  const { data, error } = await db.from("vehicles").update({ ...normalizeVehicle(input), updated_at: new Date().toISOString() }).eq("id", vehicleId).select("*, customers(id, name, phone)").single();
  if (error) throw asError(error, "Não foi possível atualizar o veículo.");
  return data;
}

export async function deleteVehicle(vehicleId: string) {
  const [orders, appointments, photos] = await Promise.all([
    db.from("work_orders").select("id", { count: "exact", head: true }).eq("vehicle_id", vehicleId),
    db.from("appointments").select("id", { count: "exact", head: true }).eq("vehicle_id", vehicleId),
    db.from("vehicle_photos").select("id", { count: "exact", head: true }).eq("vehicle_id", vehicleId),
  ]);
  if ((orders.count ?? 0) > 0 || (appointments.count ?? 0) > 0 || (photos.count ?? 0) > 0) throw new Error("Este veículo possui OS, agendamento ou fotos vinculadas. Preserve o cadastro para manter o histórico técnico.");
  const { error } = await db.from("vehicles").delete().eq("id", vehicleId);
  if (error) throw asError(error, "Não foi possível excluir o veículo.");
}
