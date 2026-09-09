"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Agent = { id: string; name: string; role: string; agent_type: string; status: string };
type Task = { id: string; title: string; description: string; priority: string; status: string; result: string | null; agent_id: string | null; agents?: { name: string; role: string } | { name: string; role: string }[] | null; created_at: string };
type Activity = { id: string; event_type: string; message: string; created_at: string; agents?: { name: string } | { name: string }[] | null };
type Company = { id: string; name: string; description: string | null; goal: string };
type Ticket = { id: string; subject: string; description: string; category: string | null; priority: string | null; suggested_response: string | null; status: string; customer_name: string | null };

type Workspace = { company: Company | null; agents: Agent[]; tasks: Task[]; activity: Activity[] };

const tabs = ["Overview", "Agents", "Tasks", "Support Agent"];
const priorities = ["low", "medium", "high", "urgent"];

function agentName(task: Task) {
  if (Array.isArray(task.agents)) return task.agents[0]?.name ?? "Unassigned";
  return task.agents?.name ?? "Unassigned";
}

function formatTime(value: string) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Home() {
  const [active, setActive] = useState("Overview");
  const [workspace, setWorkspace] = useState<Workspace>({ company: null, agents: [], tasks: [], activity: [] });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAgent, setTaskAgent] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ content: string; sources: { title: string }[] } | null>(null);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketMessage, setTicketMessage] = useState("");

  async function loadWorkspace() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/workpilot", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load workspace.");
      setWorkspace(data);
      if (!taskAgent && data.agents?.[0]) setTaskAgent(data.agents[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load workspace.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadWorkspace(); }, []);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace.company || !taskAgent || !taskTitle.trim() || !taskDescription.trim()) return;
    setActionLoading("create"); setError("");
    try {
      const response = await fetch("/api/workpilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create-task", companyId: workspace.company.id, agentId: taskAgent, title: taskTitle, description: taskDescription, priority: taskPriority }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to create task.");
      setWorkspace((current) => ({ ...current, tasks: [data.task, ...current.tasks] }));
      setWorkspace((current) => ({ ...current, activity: [{ id: crypto.randomUUID(), event_type: "task_created", message: `Task created: ${data.task.title}`, created_at: new Date().toISOString() }, ...current.activity] }));
      setTaskTitle(""); setTaskDescription("");
      setActive("Tasks");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to create task."); }
    finally { setActionLoading(""); }
  }

  async function runTask(taskId: string) {
    setActionLoading(taskId); setError("");
    try {
      const response = await fetch("/api/run-agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to run agent.");
      await loadWorkspace();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to run agent."); setActionLoading(""); }
  }

  async function approveTask(taskId: string, decision: "approved" | "rejected") {
    setActionLoading(taskId + decision); setError("");
    try {
      const response = await fetch("/api/workpilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approval", taskId, decision }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update approval.");
      await loadWorkspace();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update approval."); }
    finally { setActionLoading(""); }
  }

  async function askKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim()) return;
    setActionLoading("ask"); setError(""); setAnswer(null);
    try {
      const response = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to answer.");
      setAnswer({ content: data.answer, sources: (data.sources ?? []).map((source: { title: string }) => ({ title: source.title })) });
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to answer."); }
    finally { setActionLoading(""); }
  }

  async function loadTickets() {
    try {
      const response = await fetch("/api/tickets", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setTickets(data.tickets ?? []);
    } catch { /* Support ticket history is optional for the dashboard. */ }
  }

  useEffect(() => { if (active === "Support Agent") loadTickets(); }, [active]);

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticketSubject.trim() || !ticketDescription.trim()) return;
    setActionLoading("ticket"); setTicketMessage(""); setError("");
    try {
      const response = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: ticketSubject, description: ticketDescription }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to analyze ticket.");
      setTickets((current) => [data.ticket, ...current]); setTicketSubject(""); setTicketDescription("");
      setTicketMessage("Support Agent analyzed the ticket and created a human-review draft.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to analyze ticket."); }
    finally { setActionLoading(""); }
  }

  const stats = useMemo(() => ({
    activeAgents: workspace.agents.filter((agent) => agent.status === "working").length,
    review: workspace.tasks.filter((task) => task.status === "review").length,
    done: workspace.tasks.filter((task) => task.status === "done").length,
    open: workspace.tasks.filter((task) => !["done"].includes(task.status)).length,
  }), [workspace]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">W</div><div><strong>WorkPilot</strong><span>AI workforce control plane</span></div></div>
        <div className="company-switcher"><span>COMPANY</span><strong>{workspace.company?.name ?? "Loading..."}</strong><small>AI operations workspace</small></div>
        <nav>{tabs.map((tab) => <button key={tab} className={active === tab ? "nav-item active" : "nav-item"} onClick={() => setActive(tab)}><span>{tab === "Overview" ? "◈" : tab === "Agents" ? "✦" : tab === "Tasks" ? "☷" : "◉"}</span>{tab}</button>)}</nav>
        <div className="sidebar-note"><strong>Human-in-the-loop</strong><p>Agents can work on tasks, but outputs stay in review until you approve them.</p></div>
        <div className="sidebar-footer">v1.0 • Portfolio build</div>
      </aside>

      <section className="main-area">
        <header className="main-header"><div><span className="breadcrumb">WORKSPACE / {active.toUpperCase()}</span><h1>{active === "Overview" ? "Company command center" : active}</h1></div><button className="refresh" onClick={loadWorkspace} disabled={loading}>↻ Refresh</button></header>

        {error && <div className="global-error">{error}</div>}

        {active === "Overview" && <>
          <section className="goal-card"><div><span className="section-kicker">COMPANY GOAL</span><h2>{workspace.company?.goal}</h2><p>{workspace.company?.description}</p></div><div className="goal-badge">AI workforce<br /><strong>ONLINE</strong></div></section>
          <div className="stat-grid"><div><span>AGENTS WORKING</span><strong>{stats.activeAgents}</strong><small>of {workspace.agents.length} agents</small></div><div><span>OPEN WORK</span><strong>{stats.open}</strong><small>tasks in pipeline</small></div><div><span>NEEDS REVIEW</span><strong>{stats.review}</strong><small>human approval required</small></div><div><span>COMPLETED</span><strong>{stats.done}</strong><small>approved outcomes</small></div></div>
          <div className="content-grid"><section className="card"><div className="card-heading"><div><span className="section-kicker">WORKFORCE</span><h2>Agent team</h2></div><button className="text-button" onClick={() => setActive("Agents")}>View all →</button></div><div className="agent-mini-list">{workspace.agents.slice(0, 5).map((agent) => <div className="agent-row" key={agent.id}><div className="agent-avatar">{agent.name.slice(0, 1)}</div><div><strong>{agent.name}</strong><span>{agent.role}</span></div><i className={`status-dot ${agent.status}`} /><em>{agent.status}</em></div>)}</div></section><section className="card"><div className="card-heading"><div><span className="section-kicker">ACTIVITY</span><h2>Latest events</h2></div></div><div className="activity-list">{workspace.activity.slice(0, 6).map((item) => <div className="activity-row" key={item.id}><span className="activity-icon">•</span><div><strong>{item.message}</strong><small>{formatTime(item.created_at)}</small></div></div>)}{!workspace.activity.length && <p className="muted">Activity will appear as agents work.</p>}</div></section></div>
          <section className="card task-card"><div className="card-heading"><div><span className="section-kicker">EXECUTION</span><h2>Work queue</h2></div><button className="text-button" onClick={() => setActive("Tasks")}>Manage tasks →</button></div><TaskTable tasks={workspace.tasks.slice(0, 5)} onRun={runTask} onApprove={approveTask} actionLoading={actionLoading} /></section>
        </>}

        {active === "Agents" && <section className="card page-card"><div className="card-heading"><div><span className="section-kicker">AI WORKFORCE</span><h2>Your agents</h2><p>Specialized roles give the company goal a practical execution layer.</p></div></div><div className="agent-grid">{workspace.agents.map((agent) => <article className="agent-card" key={agent.id}><div className="agent-card-top"><div className="agent-avatar large">{agent.name.slice(0, 1)}</div><span className={`agent-status ${agent.status}`}>{agent.status}</span></div><h3>{agent.name}</h3><p>{agent.role}</p><span className="agent-type">{agent.agent_type} agent</span><div className="agent-rule" /></article>)}</div></section>}

        {active === "Tasks" && <>
          <section className="card create-task-card"><div className="card-heading"><div><span className="section-kicker">NEW WORK</span><h2>Assign a task to an agent</h2><p>Tasks are executed by Gemini and returned to you for approval.</p></div></div><form className="task-form" onSubmit={createTask}><div className="task-fields"><input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task title" required /><select value={taskAgent} onChange={(e) => setTaskAgent(e.target.value)}>{workspace.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} — {agent.role}</option>)}</select><select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></div><textarea value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder="Describe the outcome you want the agent to produce..." rows={3} required /><button className="primary" disabled={actionLoading === "create"}>{actionLoading === "create" ? "Creating..." : "Create task →"}</button></form></section>
          <section className="card page-card"><div className="card-heading"><div><span className="section-kicker">TASK MANAGER</span><h2>Execution queue</h2></div><span className="count-pill">{workspace.tasks.length} tasks</span></div><TaskTable tasks={workspace.tasks} onRun={runTask} onApprove={approveTask} actionLoading={actionLoading} /></section>
        </>}

        {active === "Support Agent" && <>
          <section className="goal-card support-hero"><div><span className="section-kicker">SPECIALIZED AGENT</span><h2>Support Agent</h2><p>Use the same workforce platform to answer company questions and turn customer issues into structured, reviewable work.</p></div><div className="agent-avatar large">S</div></section>
          <div className="content-grid support-grid"><section className="card"><div className="card-heading"><div><span className="section-kicker">KNOWLEDGE</span><h2>Ask the company brain</h2></div></div><form className="knowledge-form" onSubmit={askKnowledge}><textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="How do I handle a duplicate payment?" rows={4} /><button className="primary" disabled={actionLoading === "ask"}>{actionLoading === "ask" ? "Thinking..." : "Ask knowledge base →"}</button></form>{answer && <div className="answer-box"><span className="section-kicker">GROUNDED ANSWER</span><p>{answer.content}</p><small>Sources: {answer.sources.map((source) => source.title).join(" • ")}</small></div>}</section><section className="card"><div className="card-heading"><div><span className="section-kicker">TICKET INTELLIGENCE</span><h2>Analyze a customer issue</h2></div></div><form className="knowledge-form" onSubmit={createTicket}><input value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} placeholder="Ticket subject" required /><textarea value={ticketDescription} onChange={(e) => setTicketDescription(e.target.value)} placeholder="Customer issue..." rows={4} required /><button className="primary" disabled={actionLoading === "ticket"}>{actionLoading === "ticket" ? "Analyzing..." : "Create & analyze →"}</button></form>{ticketMessage && <p className="success-text">✓ {ticketMessage}</p>}</section></div>
          <section className="card page-card"><div className="card-heading"><div><span className="section-kicker">RECENT SUPPORT WORK</span><h2>Tickets</h2></div></div><div className="support-list">{tickets.map((ticket) => <article className="support-item" key={ticket.id}><div><span className="ticket-id">#{ticket.id.slice(0, 8)}</span><h3>{ticket.subject}</h3><p>{ticket.description}</p></div><div className="support-side"><span className={`priority priority-${ticket.priority ?? "medium"}`}>{ticket.priority ?? "medium"}</span><strong>{ticket.category ?? "other"}</strong>{ticket.suggested_response && <small>{ticket.suggested_response}</small>}</div></article>)}{!tickets.length && <p className="muted">Create a ticket to see AI classification and a review-ready response here.</p>}</div></section>
        </>}

        <footer>WorkPilot AI • Paperclip-inspired portfolio project • Gemini free tier • Supabase • Vercel</footer>
      </section>
    </main>
  );
}

function TaskTable({ tasks, onRun, onApprove, actionLoading }: { tasks: Task[]; onRun: (id: string) => void; onApprove: (id: string, decision: "approved" | "rejected") => void; actionLoading: string }) {
  if (!tasks.length) return <p className="muted empty">No tasks yet. Create one above.</p>;
  return <div className="task-table"><div className="task-table-head"><span>WORK</span><span>AGENT</span><span>PRIORITY</span><span>STATUS</span><span>ACTION</span></div>{tasks.map((task) => <article className="task-row" key={task.id}><div><strong>{task.title}</strong><p>{task.description}</p>{task.result && <div className="task-result"><span>AI OUTPUT</span><p>{task.result}</p></div>}</div><span className="agent-name">{agentName(task)}</span><span className={`priority priority-${task.priority}`}>{task.priority}</span><span className={`task-status status-${task.status}`}>{task.status}</span><div className="task-actions">{["todo", "blocked"].includes(task.status) && <button className="run-button" onClick={() => onRun(task.id)} disabled={actionLoading === task.id}>{actionLoading === task.id ? "Running..." : "Run agent"}</button>}{task.status === "review" && <><button className="approve" onClick={() => onApprove(task.id, "approved")} disabled={actionLoading === task.id + "approved"}>Approve</button><button className="reject" onClick={() => onApprove(task.id, "rejected")} disabled={actionLoading === task.id + "rejected"}>Reject</button></>}{task.status === "done" && <span className="done-mark">✓ Approved</span>}</div></article>)}</div>;
}
