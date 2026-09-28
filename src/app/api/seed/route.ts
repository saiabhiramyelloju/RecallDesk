import { NextResponse } from "next/server";
import { seedCustomers, seedEvents, seedMessages, seedTickets } from "@/data/seed";
import { apiError, getSupabaseAdmin } from "@/lib/supabase";
import { ensureMemoryBank, retainResolution } from "@/lib/hindsight";

export async function POST() {
  try {
    const db = getSupabaseAdmin();
    const { error: customersError } = await db.from("customers").upsert(seedCustomers, { onConflict: "id" }); if (customersError) throw customersError;
    const { error: ticketsError } = await db.from("tickets").upsert(seedTickets, { onConflict: "id" }); if (ticketsError) throw ticketsError;
    const { error: messagesError } = await db.from("messages").upsert(seedMessages, { onConflict: "id" }); if (messagesError) throw messagesError;
    const { error: eventsError } = await db.from("ticket_events").upsert(seedEvents, { onConflict: "id" }); if (eventsError) throw eventsError;
    await ensureMemoryBank();
    for (const ticket of seedTickets.filter((item) => item.resolution)) { const [{ data: customer }, { data: storedTicket }] = await Promise.all([db.from("customers").select("*").eq("id", ticket.customer_id).single(), db.from("tickets").select("*").eq("id", ticket.id).single()]); if (customer && storedTicket) await retainResolution(customer, storedTicket, ticket.resolution as string); }
    return NextResponse.json({ success: true, seededCount: seedCustomers.length + seedTickets.length, message: `${seedCustomers.length} customers and ${seedTickets.length} tickets loaded into Supabase; resolutions retained in Hindsight.` });
  } catch (error) { const message = error instanceof Error && error.message === "HINDSIGHT_NOT_CONFIGURED" ? "Supabase seed completed only if the database was reachable, but Hindsight is not configured for resolution retention." : apiError(error, "Demo data could not be seeded."); return NextResponse.json({ success: false, seededCount: 0, message }, { status: 503 }); }
}
