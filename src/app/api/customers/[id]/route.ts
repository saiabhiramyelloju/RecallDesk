import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getSupabaseAdmin, isUuid } from "@/lib/supabase";

const updateSchema = z.object({ name: z.string().trim().min(2).max(120).optional(), company: z.string().trim().min(2).max(120).optional(), email: z.string().email().optional(), plan: z.string().trim().min(2).max(60).optional(), environment: z.string().trim().min(2).max(200).optional(), status: z.string().trim().min(2).max(60).optional() }).partial();

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid customer id." }, { status: 400 });
  try { const { data, error } = await getSupabaseAdmin().from("customers").select("*").eq("id", id).single(); if (error || !data) return NextResponse.json({ error: "Customer not found." }, { status: 404 }); return NextResponse.json(data); }
  catch (error) { return NextResponse.json({ error: apiError(error) }, { status: 503 }); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid customer id." }, { status: 400 });
  try { const input = updateSchema.parse(await request.json()); const { data, error } = await getSupabaseAdmin().from("customers").update(input).eq("id", id).select().single(); if (error || !data) return NextResponse.json({ error: "Customer not found." }, { status: 404 }); return NextResponse.json(data); }
  catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid customer fields." }, { status: 400 }); return NextResponse.json({ error: apiError(error, "Customer could not be updated.") }, { status: 503 }); }
}
