"use client";

import { FormEvent, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";

const suggestions = [
  "How do I handle a duplicate payment?",
  "What is our refund policy?",
  "How do I escalate a priority ticket?",
];

type Answer = {
  content: string;
  title: string;
};

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
      const supabase = createSupabaseClient();
      const { data, error: queryError } = await supabase
        .from("knowledge_chunks")
        .select("content, knowledge_documents(title)");

      if (queryError) throw queryError;

      const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 2);
      const ranked = (data ?? [])
        .map((item) => {
          const text = item.content.toLowerCase();
          const score = terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
          const document = Array.isArray(item.knowledge_documents) ? item.knowledge_documents[0] : item.knowledge_documents;
          return { ...item, score, title: document?.title ?? "Knowledge source" };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

      if (!ranked.length) {
        setAnswer({
          title: "No grounded answer found",
          content: "I couldn't find a relevant answer in the connected company knowledge base. Try asking about billing, refunds, duplicate payments, or priority escalation.",
        });
      } else {
        setAnswer({ title: ranked[0].title, content: ranked[0].content });
      }

      await supabase.from("conversations").insert({
        question: query,
        answer: ranked[0]?.content ?? "No grounded answer found",
      });
    } catch (err) {
      console.error(err);
      setError("Supabase is not connected yet. Add the two environment variables in Vercel, then try again.");
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
        <p>Ask questions using your company&apos;s trusted knowledge. SupportPilot retrieves the most relevant internal guidance and shows its source.</p>
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
              <div><h2>Ask your knowledge base</h2><p>Answers are grounded in the connected company documentation.</p></div>
              <span className="source-count">3 knowledge chunks</span>
            </div>

            <form onSubmit={submit} className="ask-form">
              <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a question about your product, policy, or process..." rows={4} />
              <div className="form-footer"><span>⌘ Enter to ask</span><button type="submit" className="primary" disabled={loading}>{loading ? 'Searching...' : 'Ask SupportPilot'} <span>→</span></button></div>
            </form>

            {error ? <div className="answer-preview"><div className="answer-label">CONNECTION</div><h3>Supabase needs one final configuration step.</h3><p>{error}</p></div> : answer ? (
              <div className="answer-preview">
                <div className="answer-label">GROUNDED RESPONSE</div>
                <h3>{answer.content}</h3>
                <div className="source-placeholder"><span>◉</span> Source: {answer.title}</div>
              </div>
            ) : (
              <div className="suggestions"><span>Try an example</span><div>{suggestions.map((item) => <button key={item} onClick={() => setQuestion(item)}>{item} <span>↗</span></button>)}</div></div>
            )}
          </div>
        ) : (
          <div className="panel ticket-panel"><div className="ticket-icon">✦</div><h2>Support ticket assistant</h2><p>Next: classify tickets, identify priority, find relevant knowledge, and draft a response for an agent to review.</p><div className="flow"><span>Ticket</span><b>→</b><span>AI classify</span><b>→</b><span>Knowledge</span><b>→</b><span>Draft response</span></div></div>
        )}
      </section>

      <footer><span>Built as an AI implementation portfolio project</span><span>v0.2 • Supabase connected</span></footer>
    </main>
  );
}
