import { HindsightClient, type RecallResult } from "@vectorize-io/hindsight-client";
import type { Customer, Ticket } from "@/lib/types";

export type RecalledMemory = { text: string; type?: string; date?: string; score?: number; title?: string };
const bankId = process.env.HINDSIGHT_BANK_ID || "recalldesk-support";
const baseUrl = process.env.HINDSIGHT_BASE_URL || "https://api.hindsight.vectorize.io";

export function getHindsightClient() {
  const apiKey = process.env.HINDSIGHT_API_KEY;
  if (!apiKey) throw new Error("HINDSIGHT_NOT_CONFIGURED");
  return new HindsightClient({ baseUrl, apiKey });
}

export async function ensureMemoryBank() {
  await getHindsightClient().createBank(bankId, { name: "RecallDesk Support", retainMission: "Extract concrete customer support incidents, environments, causes, and successful resolutions.", reflectMission: "Use support history to help an agent resolve the current customer issue accurately." });
}

function metadataFor(customer: Customer, ticket?: Ticket) { return { customerId: customer.id, ...(ticket ? { ticketId: ticket.id, priority: ticket.priority } : {}), environment: customer.environment }; }

export async function retainInteraction(customer: Customer, ticket: Ticket, userMessage: string, assistantResponse: string) {
  await ensureMemoryBank();
  await getHindsightClient().retain(bankId, `Customer ${customer.name} at ${customer.company} reported this issue on ticket "${ticket.title}": ${userMessage}\nSupport agent response: ${assistantResponse}\nCustomer environment: ${customer.environment}.`, { metadata: metadataFor(customer, ticket), documentId: `ticket-${ticket.id}-conversation`, updateMode: "append", tags: [customer.id, ticket.id] });
}

export async function retainResolution(customer: Customer, ticket: Ticket, resolution: string) {
  await ensureMemoryBank();
  await getHindsightClient().retain(bankId, `Customer ${customer.name} at ${customer.company} experienced "${ticket.title}". Environment: ${customer.environment}. Successful resolution: ${resolution}`, { metadata: metadataFor(customer, ticket), documentId: `ticket-${ticket.id}-resolution`, updateMode: "replace", tags: [customer.id, ticket.id, "resolution"] });
}

export async function recallRelevantMemories(customer: Customer, ticket: Ticket, currentMessage: string): Promise<RecalledMemory[]> {
  await ensureMemoryBank();
  const response = await getHindsightClient().recall(bankId, `What previous incidents, causes, successful resolutions, environment details, and customer-specific context are relevant to ${customer.name} at ${customer.company}'s current issue on ticket "${ticket.title}": ${ticket.description}. New message: ${currentMessage}`, { maxTokens: 2400, includeChunks: true, tags: [customer.id], tagsMatch: "any" });
  return response.results.slice(0, 5).map((memory: RecallResult) => ({ text: memory.text, type: memory.type || "RECALLED CONTEXT", date: memory.mentioned_at || memory.occurred_start || undefined, score: memory.scores?.final, title: memory.metadata?.title || undefined }));
}

export function isMemoryConfigured() { return Boolean(process.env.HINDSIGHT_API_KEY); }
