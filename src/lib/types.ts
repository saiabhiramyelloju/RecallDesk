export type Customer = {
  id: string;
  name: string;
  company: string;
  email: string;
  plan: string;
  environment: string;
  status: string;
  created_at: string;
};

export type Ticket = {
  id: string;
  customer_id: string;
  title: string;
  description: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Open" | "Investigating" | "Waiting" | "Resolved";
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolution: string | null;
};

export type Message = { id: string; ticket_id: string; role: "user" | "assistant" | "system"; content: string; created_at: string };
export type TicketEvent = { id: string; ticket_id: string; event_type: string; content: string; created_at: string };

export function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
export function customerStatus(customer: Customer) { return customer.status || "Needs attention"; }
