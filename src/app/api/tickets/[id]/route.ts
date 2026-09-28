import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getSupabaseAdmin, isUuid } from "@/lib/supabase";
import { retainResolution } from "@/lib/hindsight";

const updateSchema = z.object({ title: z.string().trim().min(3).max(180).optional(), description: z.string().trim().min(3).max(4000).optional(), priority: z.enum(["Low", "Medium", "High", "Critical"]).optional(), status: z.enum(["Open", "Investigating", "Waiting", "Resolved"]).optional(), resolution: z.string().trim().min(3).max(4000).nullable().optional() }).partial();

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; if (!isUuid(id)) return NextResponse.json({ error: "Invalid ticket id." }, { status: 400 });
  try { const db = getSupabaseAdmin(); const [{ data: ticket, error: ticketError }, { data: messages, error: messagesError }, { data: events, error: eventsError }] = await Promise.all([db.from("tickets").select("*").eq("id", id).single(), db.from("messages").select("*").eq("ticket_id", id).order("created_at", { ascending: true }), db.from("ticket_events").select("*").eq("ticket_id", id).order("created_at", { ascending: true })]); if (ticketError || !ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 }); if (messagesError || eventsError) throw messagesError || eventsError; return NextResponse.json({ ticket, messages: messages ?? [], events: events ?? [] }); }
  catch (error) { return NextResponse.json({ error: apiError(error) }, { status: 503 }); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; if (!isUuid(id)) return NextResponse.json({ error: "Invalid ticket id." }, { status: 400 });
  try {
    const input = updateSchema.parse(await request.json()); const db = getSupabaseAdmin();
    const { data: before, error: beforeError } = await db.from("tickets").select("*").eq("id", id).single(); if (beforeError || !before) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    const resolved = input.status === "Resolved" && before.status !== "Resolved"; const update = { ...input, updated_at: new Date().toISOString(), ...(resolved ? { resolved_at: new Date().toISOString() } : {}) };
    const { data, error } = await db.from("tickets").update(update).eq("id", id).select().single(); if (error) throw error;
    if (input.status || input.resolution) await db.from("ticket_events").insert({ ticket_id: id, event_type: resolved ? "resolved" : "updated", content: input.resolution || `Ticket updated: ${input.status || "details changed"}` });
    if (resolved && input.resolution) { const { data: customer } = await db.from("customers").select("*").eq("id", before.customer_id).single(); if (customer) await retainResolution(customer, data, input.resolution); }
    return NextResponse.json(data);
  } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid ticket fields." }, { status: 400 }); const message = error instanceof Error && error.message === "HINDSIGHT_NOT_CONFIGURED" ? "Ticket saved, but Hindsight is not configured so the resolution could not be retained." : apiError(error, "Ticket could not be updated."); return NextResponse.json({ error: message }, { status: 503 }); }
}
