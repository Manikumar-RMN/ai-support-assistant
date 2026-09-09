"use client";

import { FormEvent, useState } from "react";

const suggestions = [
  "How do I handle a duplicate payment?",
  "What is our refund policy?",
  "How do I escalate a priority ticket?",
];

type Source = { title: string; chunkIndex: number };

type Answer = { content: string; sources: Source[] };

export default function Home() {
  const [question, setQuestion] = useState("");
  const [active, setActive] = useState("Knowledge");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
                <h3>{answer.content}</h3>
                <div className="source-placeholder">
                  <span>◉</span> Sources: {answer.sources.map((source) => source.title).filter((title, index, all) => all.indexOf(title) === index).join(" • ")}
                </div>
              </div>
            ) : (
              <div className="suggestions"><span>Try an example</span><div>{suggestions.map((item) => <button key={item} type="button" onClick={() => setQuestion(item)}>{item} <span>↗</span></button>)}</div></div>
            )}
          </div>
        ) : (
          <div className="panel ticket-panel"><div className="ticket-icon">✦</div><h2>Support ticket assistant</h2><p>Next: classify tickets, identify priority, find relevant knowledge, and draft a response for an agent to review.</p><div className="flow"><span>Ticket</span><b>→</b><span>AI classify</span><b>→</b><span>Knowledge</span><b>→</b><span>Draft response</span></div></div>
        )}
      </section>

      <footer><span>Built as an AI implementation portfolio project</span><span>v0.3 • AI grounded answers</span></footer>
    </main>
  );
}
