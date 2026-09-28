"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertCircle, ArrowUp, Check, ChevronRight, Database, LifeBuoy, Loader2, PanelRight, Plus, Search, Sparkles, Ticket as TicketIcon, UserRound, Wifi, X } from "lucide-react";
import type { Customer, Message, Ticket, TicketEvent } from "@/lib/types";
import { customerStatus, initials } from "@/lib/types";
import type { RecalledMemory } from "@/lib/hindsight";

type Notice = { tone: "good" | "bad"; text: string };
type Dialog = "customer" | "ticket" | "resolve" | null;
const demoMessage = "My API is timing out again after today's deployment.";

async function readApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data as T;
}

export default function Home() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [memories, setMemories] = useState<RecalledMemory[]>([]);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [customerForm, setCustomerForm] = useState({ name: "", company: "", email: "", plan: "Business", environment: "" });
  const [ticketForm, setTicketForm] = useState({ title: "", description: "", priority: "Medium" as Ticket["priority"] });
  const [resolution, setResolution] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const filteredCustomers = useMemo(() => customers.filter((customer) => `${customer.name} ${customer.company}`.toLowerCase().includes(query.toLowerCase())), [customers, query]);
  const openCount = tickets.filter((ticket) => ticket.status !== "Resolved").length;
  const selectedStatus = selectedCustomer ? customerStatus(selectedCustomer) : "Needs attention";

  async function boot() {
    try { const data = await readApi<Customer[]>("/api/customers"); setCustomers(data); if (data[0]) await chooseCustomer(data[0], false); }
    catch (error) { setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Supabase could not load customer data." }); }
    finally { setBooting(false); }
  }

  async function chooseCustomer(customer: Customer, clearNotice = true) {
    setSelectedCustomer(customer); setSelectedTicket(null); setMessages([]); setEvents([]); setMemories([]); if (clearNotice) setNotice(null);
    try { const data = await readApi<Ticket[]>(`/api/customers/${customer.id}/tickets`); setTickets(data); if (data[0]) await chooseTicket(data[0], false); }
    catch (error) { setTickets([]); setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Tickets could not be loaded." }); }
  }

  async function chooseTicket(ticket: Ticket, clearNotice = true) {
    setSelectedTicket(ticket); setMessages([]); setEvents([]); setMemories([]); if (clearNotice) setNotice(null);
    try { const data = await readApi<{ ticket: Ticket; messages: Message[]; events: TicketEvent[] }>(`/api/tickets/${ticket.id}`); setSelectedTicket(data.ticket); setMessages(data.messages); setEvents(data.events); }
    catch (error) { setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Ticket history could not be loaded." }); }
  }

  async function send(nextMessage?: string, forceMemory = memoryEnabled) {
    const content = (nextMessage ?? message).trim();
    if (!content || loading || !selectedCustomer || !selectedTicket) return;
    setMessage(""); setLoading(true); setNotice(null);
    const optimistic: Message = { id: `local-${Date.now()}`, ticket_id: selectedTicket.id, role: "user", content, created_at: new Date().toISOString() };
    setMessages((previous) => [...previous, optimistic]);
    try {
      const data = await readApi<{ answer: string; memoryUsed: boolean; recalledMemories: RecalledMemory[]; ticket: Ticket; messages: Message[] }>("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId: selectedTicket.id, customerId: selectedCustomer.id, message: content, memoryEnabled: forceMemory }) });
      setSelectedTicket(data.ticket); setMessages((previous) => [...previous.filter((item) => item.id !== optimistic.id), ...data.messages]); setMemories(data.recalledMemories ?? []);
      import("animejs").then(({ animate }) => { animate(".memory-panel, .message:last-child", { opacity: [0, 1], translateY: [8, 0], duration: 380, ease: "outQuart" }); });
    } catch (error) { setMessages((previous) => previous.filter((item) => item.id !== optimistic.id)); setNotice({ tone: "bad", text: error instanceof Error ? error.message : "The agent could not respond." }); }
    finally { setLoading(false); }
  }

  async function seed() {
    setNotice(null);
    try { const data = await readApi<{ message: string }>("/api/seed", { method: "POST" }); setNotice({ tone: "good", text: data.message }); await boot(); }
    catch (error) { setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Demo data could not be seeded." }); }
  }

  function runDemo(withMemory: boolean) { setMemoryEnabled(withMemory); setMessages([]); setMemories([]); window.setTimeout(() => void send(demoMessage, withMemory), 50); }

  async function createCustomer(event: React.FormEvent) {
    event.preventDefault();
    try { const created = await readApi<Customer>("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(customerForm) }); setCustomers((previous) => [created, ...previous]); setDialog(null); setCustomerForm({ name: "", company: "", email: "", plan: "Business", environment: "" }); await chooseCustomer(created); setNotice({ tone: "good", text: "Customer record created." }); }
    catch (error) { setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Customer could not be created." }); }
  }

  async function createTicket(event: React.FormEvent) {
    event.preventDefault(); if (!selectedCustomer) return;
    try { const created = await readApi<Ticket>("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...ticketForm, customerId: selectedCustomer.id }) }); setTickets((previous) => [created, ...previous]); setDialog(null); setTicketForm({ title: "", description: "", priority: "Medium" }); await chooseTicket(created); setNotice({ tone: "good", text: "Ticket created and ready for chat." }); }
    catch (error) { setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Ticket could not be created." }); }
  }

  async function resolveTicket(event: React.FormEvent) {
    event.preventDefault(); if (!selectedTicket || !resolution.trim()) return;
    try { const updated = await readApi<Ticket>(`/api/tickets/${selectedTicket.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Resolved", resolution }) }); setSelectedTicket(updated); setTickets((previous) => previous.map((item) => item.id === updated.id ? updated : item)); setEvents((previous) => [...previous, { id: `local-${Date.now()}`, ticket_id: updated.id, event_type: "resolved", content: resolution, created_at: new Date().toISOString() }]); setDialog(null); setResolution(""); setNotice({ tone: "good", text: "Ticket resolved and resolution retained in Hindsight." }); }
    catch (error) { setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Ticket could not be resolved." }); }
  }

  useEffect(() => {
    void Promise.resolve().then(() => boot());
    import("animejs").then(({ animate }) => { animate(".app-shell", { opacity: [0, 1], translateY: [10, 0], duration: 500, ease: "outQuart" }); });
    // The workspace bootstrap intentionally runs once when the client mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (booting) return <main className="app-shell"><div className="boot-state"><LifeBuoy size={22} /><span>Loading support workspace…</span></div></main>;

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark"><LifeBuoy size={17} /></span><span>Recall<span className="brand-accent">Desk</span></span><span className="beta">MVP</span></div><div className="topbar-right"><div className={`connection ${memoryEnabled ? "active" : ""}`}><span className="status-dot" /> {memoryEnabled ? "Hindsight connected" : "Cold start mode"}</div><div className="online"><Wifi size={14} /> Online</div><button className="icon-button" aria-label="Context panel"><PanelRight size={17} /></button></div></header>
    <div className="workspace">
      <aside className="sidebar"><div className="side-heading"><div><p className="eyebrow">Workspace</p><h2>Customers</h2></div><span className="count">{customers.length}</span></div><div className="search"><Search size={15} /><input aria-label="Search customers" placeholder="Search customers" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="customer-list">{filteredCustomers.map((customer) => <button key={customer.id} className={`customer-card ${customer.id === selectedCustomer?.id ? "selected" : ""}`} onClick={() => void chooseCustomer(customer)}><span className="avatar">{initials(customer.name)}</span><span className="customer-copy"><strong>{customer.name}</strong><small>{customer.company}</small><span className="customer-status"><span className={`mini-dot ${customerStatus(customer) === "Needs attention" ? "warn" : customerStatus(customer) === "Resolved" ? "done" : ""}`} />{customerStatus(customer)}</span></span><ChevronRight className="chevron" size={16} /></button>)}</div><button className="new-record-button" onClick={() => setDialog("customer")}><Plus size={14} /> New customer</button>{selectedCustomer && <div className="ticket-nav"><div className="ticket-nav-heading"><span>Tickets</span><button onClick={() => setDialog("ticket")} aria-label="New ticket"><Plus size={14} /></button></div>{tickets.map((ticket) => <button key={ticket.id} className={`ticket-link ${ticket.id === selectedTicket?.id ? "selected" : ""}`} onClick={() => void chooseTicket(ticket)}><span className={`priority-dot ${ticket.priority.toLowerCase()}`} /><span><strong>{ticket.title}</strong><small>{ticket.status} · {ticket.priority}</small></span></button>)}{!tickets.length && <p className="empty-nav">No tickets yet.</p>}</div>}<div className="sidebar-footer"><div className="mini-metrics"><span><strong>{openCount}</strong> open</span><span><strong>{customers.length}</strong> customers</span></div><button className="seed-button" onClick={() => void seed()}><Database size={15} /> Seed Supabase + memory</button><p>Source: live customer and ticket records.</p></div></aside>
      <section className="chat-panel">{selectedCustomer && selectedTicket ? <><div className="customer-header"><div className="customer-identity"><span className="avatar large">{initials(selectedCustomer.name)}</span><div><div className="name-line"><h1>{selectedCustomer.name}</h1><span className="plan">{selectedCustomer.plan}</span></div><p>{selectedCustomer.company} <span className="muted-separator">·</span> {selectedCustomer.environment}</p></div></div><div className="header-meta"><span className={`issue-badge ${selectedStatus === "Needs attention" ? "attention" : ""}`}><span className="mini-dot" />{selectedTicket.status}</span><span className="customer-id">{selectedTicket.priority} priority · {selectedCustomer.email}</span></div></div><div className="context-strip"><div><span className="strip-label">Current ticket <span className="source-label">Source: Customer record</span></span><strong>{selectedTicket.title}</strong><small>{selectedTicket.description}</small></div><div className="ticket-actions"><span className={`ticket-status ${selectedTicket.status.toLowerCase()}`}>{selectedTicket.status}</span>{selectedTicket.status !== "Resolved" && <button onClick={() => setDialog("resolve")}><Check size={13} /> Resolve ticket</button>}</div></div><div className="conversation"><div className="conversation-label"><span>Support conversation</span><span>{messages.length ? `${messages.length} messages` : "Empty conversation"}</span></div>{messages.length === 0 && <div className="empty-state"><div className="empty-icon"><Sparkles size={21} /></div><h3>Start with this ticket</h3><p>Ask about the issue. The response and conversation will be persisted to Supabase.</p><div className="quick-prompts"><button onClick={() => setMessage(demoMessage)}>API timeout after deployment <ArrowUp size={13} /></button><button onClick={() => setMessage("What should I check before changing the application code?")}>Suggest next checks <ArrowUp size={13} /></button></div></div>}{messages.map((item) => <div key={item.id} className={`message-row ${item.role === "assistant" ? "assistant" : "user"}`}><span className={`message-avatar ${item.role}`}>{item.role === "assistant" ? <LifeBuoy size={14} /> : <UserRound size={14} />}</span><div className="message-content"><span className="message-label">{item.role === "assistant" ? "RecallDesk" : selectedCustomer.name} <span>{item.role === "assistant" && memories.length ? "· memory used" : ""}</span></span><div className="message-bubble">{item.content}</div>{item.role === "assistant" && memories.length > 0 && <div className="response-chip"><Check size={13} /> Historical context improved this response</div>}</div></div>)}{loading && <div className="message-row assistant"><span className="message-avatar assistant"><LifeBuoy size={14} /></span><div className="message-content"><span className="message-label">RecallDesk</span><div className="message-bubble loading-bubble"><Loader2 size={15} className="spin" /> Checking customer context…</div></div></div>}</div><div className="composer-wrap"><div className="composer"><textarea ref={composerRef} aria-label="Ask a support question" placeholder="Ask about this ticket…" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} /><button className="send-button" aria-label="Send message" onClick={() => void send()} disabled={!message.trim() || loading}><ArrowUp size={18} /></button></div><div className="composer-hint"><span>Enter to send <span>·</span> Shift + Enter for a new line</span><span className="secure"><Activity size={12} /> Supabase persisted</span></div></div></> : <div className="empty-workspace"><TicketIcon size={22} /><h2>Select a ticket to start</h2><p>Create a ticket for a customer, then chat with RecallDesk.</p><button className="primary-button" onClick={() => setDialog(selectedCustomer ? "ticket" : "customer")}><Plus size={14} /> {selectedCustomer ? "New ticket" : "New customer"}</button></div>}</section>
      <aside className="memory-panel"><div className="memory-heading"><div><p className="eyebrow">Context layer</p><h2>Memory <span>Hindsight</span></h2></div><div className={`memory-orb ${memoryEnabled ? "on" : ""}`}><Database size={15} /></div></div><div className="memory-toggle-row"><div><strong>Memory</strong><p>{memoryEnabled ? "Historical context is active" : "Cold start — no historical context"}</p></div><button className={`toggle ${memoryEnabled ? "on" : ""}`} aria-label={`Turn memory ${memoryEnabled ? "off" : "on"}`} aria-pressed={memoryEnabled} onClick={() => { setMemoryEnabled(!memoryEnabled); setMemories([]); }}><span /></button></div><div className={`recall-banner ${memoryEnabled && memories.length ? "recalled" : ""}`}><span className="recall-icon">{memoryEnabled ? <Database size={14} /> : <AlertCircle size={14} />}</span><div><strong>{memoryEnabled ? `${memories.length || 0} memories recalled` : "Cold start"}</strong><span>{memoryEnabled ? memories.length ? "Relevant memories from Hindsight" : "Ask a question to recall context" : "No historical memory used"}</span></div></div><div className="memory-list">{memories.length ? memories.map((memory, index) => <article className="memory-card" key={`${memory.text}-${index}`}><div className="memory-card-top"><span className="memory-type">{memory.type || "RECALLED CONTEXT"}</span>{memory.score ? <span className="relevance">{Math.round(memory.score * 100)}% match</span> : null}</div><h3>{memory.title || "Relevant support context"}</h3><p>{memory.text}</p>{memory.date && <span className="memory-date">{memory.date}</span>}<span className="memory-source">Source: Hindsight</span></article>) : <div className="memory-empty"><Database size={17} /><p>{memoryEnabled ? "Relevant memories will appear here after the next question." : "Turn Memory ON to retrieve prior support history for this ticket."}</p></div>}</div><div className="timeline"><p className="eyebrow">Historical timeline</p>{events.slice(-3).map((event) => <div className="timeline-item" key={event.id}><span className="timeline-line" /><div><strong>{event.event_type === "resolved" ? "Previous resolution" : "Ticket event"}</strong><p>{event.content}</p><small>{new Date(event.created_at).toLocaleDateString()}</small></div></div>)}{selectedTicket && <div className="timeline-item current"><span className="timeline-line" /><div><strong>Current incident</strong><p>{selectedTicket.title}</p><small>Source: Customer record</small></div></div>}</div><div className="demo-controls"><p className="eyebrow">Judge the difference</p><button onClick={() => runDemo(false)} disabled={!selectedTicket}><span><span className="demo-dot cold" />Cold Start Demo</span><ArrowUp size={14} /></button><button onClick={() => runDemo(true)} disabled={!selectedTicket}><span><span className="demo-dot warm" />Run Memory Demo</span><ArrowUp size={14} /></button></div></aside>
    </div>{notice && <div className={`toast ${notice.tone}`}><span>{notice.tone === "good" ? <Check size={15} /> : <AlertCircle size={15} />}</span>{notice.text}<button onClick={() => setNotice(null)} aria-label="Dismiss notification">×</button></div>}
    {dialog && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}><div className="dialog" role="dialog" aria-modal="true"><button className="dialog-close" onClick={() => setDialog(null)} aria-label="Close dialog"><X size={17} /></button>{dialog === "customer" && <form onSubmit={createCustomer}><p className="eyebrow">Customer record</p><h2>New customer</h2><p className="dialog-copy">Add a customer to the live Supabase workspace.</p><label>Name<input required value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} /></label><label>Company<input required value={customerForm.company} onChange={(event) => setCustomerForm({ ...customerForm, company: event.target.value })} /></label><label>Email<input required type="email" value={customerForm.email} onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })} /></label><label>Plan<input required value={customerForm.plan} onChange={(event) => setCustomerForm({ ...customerForm, plan: event.target.value })} /></label><label>Environment<input required placeholder="AWS · Kubernetes · PostgreSQL" value={customerForm.environment} onChange={(event) => setCustomerForm({ ...customerForm, environment: event.target.value })} /></label><button className="primary-button" type="submit"><Plus size={14} /> Create customer</button></form>}{dialog === "ticket" && <form onSubmit={createTicket}><p className="eyebrow">Customer record</p><h2>New ticket</h2><p className="dialog-copy">Create a real ticket for {selectedCustomer?.name}.</p><label>Title<input required value={ticketForm.title} onChange={(event) => setTicketForm({ ...ticketForm, title: event.target.value })} /></label><label>Description<textarea required value={ticketForm.description} onChange={(event) => setTicketForm({ ...ticketForm, description: event.target.value })} /></label><label>Priority<select value={ticketForm.priority} onChange={(event) => setTicketForm({ ...ticketForm, priority: event.target.value as Ticket["priority"] })}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label><button className="primary-button" type="submit"><Plus size={14} /> Create ticket</button></form>}{dialog === "resolve" && <form onSubmit={resolveTicket}><p className="eyebrow">Learning loop</p><h2>Resolve ticket</h2><p className="dialog-copy">Save the successful fix to the ticket and Hindsight.</p><label>Resolution<textarea required placeholder="What fixed the issue?" value={resolution} onChange={(event) => setResolution(event.target.value)} /></label><button className="primary-button" type="submit"><Check size={14} /> Save resolution</button></form>}</div></div>}
  </main>;
}
