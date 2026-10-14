import { supabase } from "../lib/supabase";

export type TicketStatus = "open" | "in_progress" | "waiting_response" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  resolution: string | null;
  response_count: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface TicketResponse {
  id: string;
  user_id: string | null;
  user_name: string;
  user_role: string | null;
  message: string;
  is_internal: boolean;
  created_at: string;
}

/**
 * Reads degrade to an empty list when the support SQL isn't deployed, so the
 * screen shows its empty state instead of an error. Writes still throw.
 */
export const listMyTickets = async (userId: string): Promise<SupportTicket[]> => {
  const { data, error } = await supabase.rpc("get_user_support_tickets", { p_user_id: userId });
  if (error) {
    console.warn("get_user_support_tickets unavailable:", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    subject: String(row.subject ?? ""),
    description: String(row.description ?? ""),
    category: String(row.category ?? "general"),
    priority: (row.priority as TicketPriority) ?? "medium",
    status: (row.status as TicketStatus) ?? "open",
    resolution: (row.resolution as string | null) ?? null,
    response_count: Number(row.response_count ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at ?? row.created_at),
    resolved_at: (row.resolved_at as string | null) ?? null,
  }));
};

export const createTicket = async (input: {
  userId: string;
  subject: string;
  description: string;
  category?: string;
  priority?: TicketPriority;
}): Promise<string | null> => {
  const { data, error } = await supabase.rpc("create_support_ticket", {
    p_user_id: input.userId,
    p_subject: input.subject,
    p_description: input.description,
    p_category: input.category ?? "general",
    p_priority: input.priority ?? "medium",
  });
  if (error) throw error;
  return (data as string | null) ?? null;
};

export const listTicketResponses = async (ticketId: string): Promise<TicketResponse[]> => {
  const { data, error } = await supabase.rpc("get_ticket_responses", {
    p_ticket_id: ticketId,
    p_include_internal: false,
  });
  if (error) {
    console.warn("get_ticket_responses unavailable:", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    user_id: (row.user_id as string | null) ?? null,
    user_name: String(row.user_name ?? ""),
    user_role: (row.user_role as string | null) ?? null,
    message: String(row.message ?? ""),
    is_internal: Boolean(row.is_internal),
    created_at: String(row.created_at),
  }));
};

export const replyToTicket = async (ticketId: string, userId: string, message: string) => {
  const { error } = await supabase.rpc("add_ticket_response", {
    p_ticket_id: ticketId,
    p_user_id: userId,
    p_message: message,
    p_is_internal: false,
  });
  if (error) throw error;
};
