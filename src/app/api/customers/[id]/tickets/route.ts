import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getSupabaseAdmin, isUuid } from "@/lib/supabase";

const ticketSchema = z.object({ title: z.string().trim().min(3).max(180), description: z.string().trim().min(3).max(4000), priority: z.enum(["Low", "Medium", "High", "Critical"]).default("Medium") });

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; if (!isUuid(id)) return NextResponse.json({ error: "Invalid customer id." }, { status: 400 });
  try { const { data, error } = await getSupabaseAdmin().from("tickets").select("*").eq("customer_id", id).order("updated_at", { ascending: false }); if (error) throw error; return NextResponse.json(data ?? []); }
  catch (error) { return NextResponse.json({ error: apiError(error) }, { status: 503 }); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; if (!isUuid(id)) return NextResponse.json({ error: "Invalid customer id." }, { status: 400 });
  try { const input = ticketSchema.parse(await request.json()); const { data, error } = await getSupabaseAdmin().from("tickets").insert({ ...input, customer_id: id }).select().single(); if (error) throw error; return NextResponse.json(data, { status: 201 }); }
  catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid title, description, and priority." }, { status: 400 }); return NextResponse.json({ error: apiError(error, "Ticket could not be created.") }, { status: 503 }); }
}
