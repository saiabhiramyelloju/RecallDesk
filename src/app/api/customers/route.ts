import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getSupabaseAdmin } from "@/lib/supabase";

const customerSchema = z.object({ name: z.string().trim().min(2).max(120), company: z.string().trim().min(2).max(120), email: z.string().email(), plan: z.string().trim().min(2).max(60), environment: z.string().trim().min(2).max(200) });

export async function GET() {
  try { const { data, error } = await getSupabaseAdmin().from("customers").select("*").order("created_at", { ascending: false }); if (error) throw error; return NextResponse.json(data ?? []); }
  catch (error) { return NextResponse.json({ error: apiError(error) }, { status: 503 }); }
}

export async function POST(request: Request) {
  try { const input = customerSchema.parse(await request.json()); const { data, error } = await getSupabaseAdmin().from("customers").insert(input).select().single(); if (error) throw error; return NextResponse.json(data, { status: 201 }); }
  catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid name, company, email, plan, and environment." }, { status: 400 }); return NextResponse.json({ error: apiError(error, "Customer could not be created.") }, { status: 503 }); }
}
