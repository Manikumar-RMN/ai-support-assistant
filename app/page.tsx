"use client";

import { FormEvent, useEffect, useState } from "react";

const suggestions = [
  "How do I handle a duplicate payment?",
  "What is our refund policy?",
  "How do I escalate a priority ticket?",
];

type Source = { title: string; chunkIndex: number };
type Answer = { content: string; sources: Source[] };

type Ticket = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  subject: string;
  description: string;
  category: string | null;
  priority: string | null;
  suggested_response: string | null;
  status: string;
  created_at: string;
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [active, setActive] = useState("Knowledge");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketError, setTicketError] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = question.trim();
    if (!query || loading) return;

    setLoading(true);
    setError("");
    setAnswer(null);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to answer the question.");
      setAnswer({ content: result.answer, sources: result.sources ?? [] });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to answer the question.");
    } finally {
      setLoading(false);
    }
  }

  async function loadTickets() {
    setTicketLoading(true);
    setTicketError("");
    try {
      const response = await fetch("/api/tickets");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to load tickets.");
      setTickets(result.tickets ?? []);
    } catch (err) {
      console.error(err);
      setTicketError(err instanceof Error ? err.message : "Unable to load tickets.");
    } finally {
      setTicketLoading(false);
    }
  }

  useEffect(() => {
    if (active === "Support tickets") loadTickets();
  }, [active]);

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject.trim() || !description.trim() || ticketLoading) return;

    setTicketLoading(true);
    setTicketError("");
    setTicketMessage("");

    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName, customerEmail, subject, description }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to create ticket.");
      setTickets((current) => [result.ticket, ...current]);
      setTicketMessage("Ticket created and analyzed by AI. Review the suggested response before sending.");
      setCustomerName("");
      setCustomerEmail("");
      setSubject("");
      setDescription("");
    } catch (err) {
      console.error(err);
      setTicketError(err instanceof Error ? err.message : "Unable to create ticket.");
    } finally {
      setTicketLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div><strong>SupportPilot</strong><span>AI support workspace</span></div>
        </div>
        <div className="status"><i /> Connected knowledge base</div>
      </header>

      <section className="hero">
        <div className="eyebrow">AI SUPPORT & KNOWLEDGE ASSISTANT</div>
        <h1>Find answers. Resolve tickets.<br /><em>Work smarter.</em></h1>
        <p>Ask questions using your company&apos;s trusted knowledge. SupportPilot retrieves relevant internal guidance and uses AI to produce a grounded answer with sources.</p>
      </section>

      <section className="workspace">
        <div className="tabs">
          {['Knowledge', 'Support tickets'].map((tab) => (
            <button key={tab} className={active === tab ? 'tab active' : 'tab'} onClick={() => setActive(tab)}>{tab}</button>
          ))}
        </div>

        {active === 'Knowledge' ? (
          <div className="panel">
            <div className="panel-heading">
              <div><h2>Ask your knowledge base</h2><p>AI answers are grounded in the connected company documentation.</p></div>
              <span className="source-count">3 knowledge chunks</span>
            </div>

            <form onSubmit={submit} className="ask-form">
              <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a question about your product, policy, or process..." rows={4} />
              <div className="form-footer"><span>⌘ Enter to ask</span><button type="submit" className="primary" disabled={loading}>{loading ? 'Thinking...' : 'Ask SupportPilot'} <span>→</span></button></div>
            </form>

            {error ? <div className="answer-preview"><div className="answer-label">ERROR</div><h3>SupportPilot could not answer.</h3><p>{error}</p></div> : answer ? (
              <div className="answer-preview">
                <div className="answer-label">AI GROUNDED RESPONSE</div>
                <div className="answer-text">{answer.content}</div>
                <div className="source-placeholder">
                  <span>◉</span> Sources: {answer.sources.map((source) => source.title).filter((title, index, all) => all.indexOf(title) === index).join(" • ")}
                </div>
              </div>
            ) : (
              <div className="suggestions"><span>Try an example</span><div>{suggestions.map((item) => <button key={item} type="button" onClick={() => setQuestion(item)}>{item} <span>↗</span></button>)}</div></div>
            )}
          </div>
        ) : (
          <div className="panel ticket-workspace">
            <div className="panel-heading">
              <div><h2>AI support ticket assistant</h2><p>Create a ticket and let AI classify priority, identify category, and draft a response from company knowledge.</p></div>
              <span className="source-count">{tickets.length} tickets</span>
            </div>

            <form onSubmit={createTicket} className="ticket-form">
              <div className="field-grid">
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name (optional)" />
                <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Customer email (optional)" />
              </div>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ticket subject" required />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the customer issue..." rows={5} required />
              <div className="form-footer"><span>AI will analyze against the knowledge base</span><button type="submit" className="primary" disabled={ticketLoading}>{ticketLoading ? 'Analyzing...' : 'Create & analyze ticket'} <span>→</span></button></div>
            </form>

            {ticketMessage && <div className="success-message">✓ {ticketMessage}</div>}
            {ticketError && <div className="ticket-error">{ticketError}</div>}

            <div className="ticket-list-heading"><h3>Recent tickets</h3><button type="button" className="refresh" onClick={loadTickets} disabled={ticketLoading}>Refresh</button></div>
            {ticketLoading && !tickets.length ? <p className="empty-state">Loading tickets...</p> : !tickets.length ? <p className="empty-state">No tickets yet. Create the first one above.</p> : (
              <div className="ticket-list">
                {tickets.map((ticket) => (
                  <article className="ticket-card" key={ticket.id}>
                    <div className="ticket-card-top">
                      <div><span className="ticket-id">#{ticket.id.slice(0, 8)}</span><h3>{ticket.subject}</h3></div>
                      <span className={`priority priority-${ticket.priority ?? 'medium'}`}>{ticket.priority ?? 'medium'}</span>
                    </div>
                    <p className="ticket-description">{ticket.description}</p>
                    <div className="ticket-meta"><span>{ticket.category ?? 'other'}</span><span>•</span><span>{ticket.status}</span>{ticket.customer_name && <><span>•</span><span>{ticket.customer_name}</span></>}</div>
                    {ticket.suggested_response && <div className="draft"><div className="answer-label">AI SUGGESTED RESPONSE</div><p>{ticket.suggested_response}</p></div>}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <footer><span>Built as an AI implementation portfolio project</span><span>v0.4 • Knowledge + ticket intelligence</span></footer>
    </main>
  );
}
