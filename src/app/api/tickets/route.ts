import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getSupabaseAdmin, isUuid } from "@/lib/supabase";

const schema = z.object({ customerId: z.string(), title: z.string().trim().min(3).max(180), description: z.string().trim().min(3).max(4000), priority: z.enum(["Low", "Medium", "High", "Critical"]).default("Medium") });
export async function POST(request: Request) { try { const input = schema.parse(await request.json()); if (!isUuid(input.customerId)) return NextResponse.json({ error: "Invalid customer id." }, { status: 400 }); const { data, error } = await getSupabaseAdmin().from("tickets").insert({ customer_id: input.customerId, title: input.title, description: input.description, priority: input.priority }).select().single(); if (error) throw error; return NextResponse.json(data, { status: 201 }); } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid customer, title, description, and priority." }, { status: 400 }); return NextResponse.json({ error: apiError(error, "Ticket could not be created.") }, { status: 503 }); } }
