"use client";

import { FormEvent, useState } from "react";

const suggestions = [
  "How do I handle a duplicate payment?",
  "What is our refund policy?",
  "How do I escalate a priority ticket?",
];

export default function Home() {
  const [question, setQuestion] = useState("");
  const [active, setActive] = useState("Knowledge");
  const [asked, setAsked] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim()) return;
    setAsked(true);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <strong>SupportPilot</strong>
            <span>AI support workspace</span>
          </div>
        </div>
        <div className="status"><i /> Demo workspace</div>
      </header>

      <section className="hero">
        <div className="eyebrow">AI SUPPORT & KNOWLEDGE ASSISTANT</div>
        <h1>Find answers. Resolve tickets.<br /><em>Work smarter.</em></h1>
        <p>Ask questions using your company&apos;s trusted knowledge. This demo will grow into a complete support automation platform.</p>
      </section>

      <section className="workspace">
        <div className="tabs">
          {['Knowledge', 'Support tickets'].map((tab) => (
            <button key={tab} className={active === tab ? 'tab active' : 'tab'} onClick={() => setActive(tab)}>
              {tab}
            </button>
          ))}
        </div>

        {active === 'Knowledge' ? (
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>Ask your knowledge base</h2>
                <p>Answers will be grounded in your company documentation.</p>
              </div>
              <span className="source-count">0 sources connected</span>
            </div>

            <form onSubmit={submit} className="ask-form">
              <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a question about your product, policy, or process..." rows={4} />
              <div className="form-footer">
                <span>⌘ Enter to ask</span>
                <button type="submit" className="primary">Ask SupportPilot <span>→</span></button>
              </div>
            </form>

            {!asked ? (
              <div className="suggestions">
                <span>Try an example</span>
                <div>
                  {suggestions.map((item) => <button key={item} onClick={() => setQuestion(item)}>{item} <span>↗</span></button>)}
                </div>
              </div>
            ) : (
              <div className="answer-preview">
                <div className="answer-label">DEMO RESPONSE</div>
                <h3>Your knowledge base will answer this question.</h3>
                <p>Next we&apos;ll connect Supabase and an AI model so answers are generated from uploaded company documents with source references.</p>
                <div className="source-placeholder"><span>◉</span> Source citations will appear here</div>
              </div>
            )}
          </div>
        ) : (
          <div className="panel ticket-panel">
            <div className="ticket-icon">✦</div>
            <h2>Support ticket assistant</h2>
            <p>Coming next: classify tickets, identify priority, find relevant knowledge, and draft a response for an agent to review.</p>
            <div className="flow"><span>Ticket</span><b>→</b><span>AI classify</span><b>→</b><span>Knowledge</span><b>→</b><span>Draft response</span></div>
          </div>
        )}
      </section>

      <footer><span>Built as an AI implementation portfolio project</span><span>v0.1 • Foundation</span></footer>
    </main>
  );
}
