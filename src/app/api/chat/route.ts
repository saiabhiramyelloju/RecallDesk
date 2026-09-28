import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getSupabaseAdmin, isUuid } from "@/lib/supabase";
import { recallRelevantMemories, retainInteraction, isMemoryConfigured, type RecalledMemory } from "@/lib/hindsight";
import { answerCustomer } from "@/lib/agent";

const schema = z.object({ ticketId: z.string(), customerId: z.string(), message: z.string().trim().min(1).max(4000), memoryEnabled: z.boolean() });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    if (!isUuid(input.customerId) || !isUuid(input.ticketId)) return NextResponse.json({ error: "Invalid customer or ticket id." }, { status: 400 });
    const db = getSupabaseAdmin();
    const [{ data: customer }, { data: ticket }, { data: conversation, error: messagesError }] = await Promise.all([db.from("customers").select("*").eq("id", input.customerId).single(), db.from("tickets").select("*").eq("id", input.ticketId).eq("customer_id", input.customerId).single(), db.from("messages").select("*").eq("ticket_id", input.ticketId).order("created_at", { ascending: true })]);
    if (messagesError) throw messagesError;
    if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    if (!ticket) return NextResponse.json({ error: "Ticket not found for this customer." }, { status: 404 });
    let memories: RecalledMemory[] = [];
    if (input.memoryEnabled) {
      if (!isMemoryConfigured()) return NextResponse.json({ error: "Memory mode is selected, but Hindsight is not configured. Add HINDSIGHT_API_KEY and try again." }, { status: 503 });
      memories = await recallRelevantMemories(customer, ticket, input.message);
    }
    const answer = await answerCustomer(customer, ticket, input.message, conversation ?? [], memories);
    const { data: userMessage, error: userError } = await db.from("messages").insert({ ticket_id: input.ticketId, role: "user", content: input.message }).select().single(); if (userError) throw userError;
    const { data: assistantMessage, error: assistantError } = await db.from("messages").insert({ ticket_id: input.ticketId, role: "assistant", content: answer }).select().single(); if (assistantError) throw assistantError;
    await db.from("tickets").update({ updated_at: new Date().toISOString(), status: ticket.status === "Resolved" ? "Resolved" : "Investigating" }).eq("id", ticket.id);
    if (input.memoryEnabled) await retainInteraction(customer, ticket, input.message, answer);
    return NextResponse.json({ answer, memoryUsed: input.memoryEnabled, recalledMemories: memories, ticket: { ...ticket, status: ticket.status === "Resolved" ? "Resolved" : "Investigating" }, customer, messages: [userMessage, assistantMessage] });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Please provide a customer and a message." }, { status: 400 });
    const code = error instanceof Error ? error.message : "";
    const message = code === "GROQ_NOT_CONFIGURED" ? "Groq is not configured. Add GROQ_API_KEY to enable the support agent." : code === "HINDSIGHT_NOT_CONFIGURED" ? "Hindsight is not configured for Memory mode." : code === "SUPABASE_NOT_CONFIGURED" ? apiError(error) : "The support agent is temporarily unavailable. Please try again.";
    return NextResponse.json({ error: message }, { status: code === "SUPABASE_NOT_CONFIGURED" ? 503 : 503 });
  }
}
