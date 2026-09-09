import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/client";

export const runtime = "nodejs";

const taskSelect = "id, company_id, agent_id, title, description, priority, status, result, created_at, updated_at, agents(name, role)";

export async function GET() {
  try {
    const supabase = createSupabaseClient();
    const [{ data: company, error: companyError }, { data: agents, error: agentsError }, { data: tasks, error: tasksError }, { data: activity, error: activityError }, { data: runs, error: runsError }, { data: heartbeats, error: heartbeatError }] = await Promise.all([
      supabase.from("companies").select("id, name, description, goal, created_at, updated_at").order("created_at", { ascending: true }).limit(1).maybeSingle(),
      supabase.from("agents").select("id, company_id, name, role, agent_type, status, system_prompt, created_at, updated_at").order("created_at", { ascending: true }),
      supabase.from("tasks").select(taskSelect).order("created_at", { ascending: false }).limit(50),
      supabase.from("activity_logs").select("id, company_id, agent_id, task_id, event_type, message, created_at, agents(name)").order("created_at", { ascending: false }).limit(50),
      supabase.from("agent_runs").select("id, agent_id, task_id, model, status, input_tokens, output_tokens, estimated_cost, duration_ms, created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("heartbeats").select("id, agent_id, enabled, interval_minutes, last_run_at, next_run_at").order("created_at", { ascending: true }),
    ]);
    if (companyError) throw companyError;
    if (agentsError) throw agentsError;
    if (tasksError) throw tasksError;
    if (activityError) throw activityError;
    if (runsError) throw runsError;
    if (heartbeatError) throw heartbeatError;
    const totalCost = (runs ?? []).reduce((sum, run) => sum + Number(run.estimated_cost ?? 0), 0);
    return NextResponse.json({ company, agents: agents ?? [], tasks: tasks ?? [], activity: activity ?? [], runs: runs ?? [], heartbeats: heartbeats ?? [], totalCost });
  } catch (error) {
    console.error("WorkPilot workspace error", error);
    return NextResponse.json({ error: "Unable to load the WorkPilot workspace." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = typeof body.action === "string" ? body.action : "";
    const supabase = createSupabaseClient();

    if (action === "update-company") {
      const companyId = typeof body.companyId === "string" ? body.companyId : "";
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const goal = typeof body.goal === "string" ? body.goal.trim() : "";
      const description = typeof body.description === "string" ? body.description.trim() : "";
      if (!companyId || !name || !goal) return NextResponse.json({ error: "Company name and goal are required." }, { status: 400 });
      const { data: company, error } = await supabase.from("companies").update({ name, goal, description }).eq("id", companyId).select("id, name, description, goal").single();
      if (error) throw error;
      await supabase.from("activity_logs").insert({ company_id: companyId, event_type: "company_updated", message: "Company goal and workspace settings updated." });
      return NextResponse.json({ company });
    }

    if (action === "create-agent") {
      const companyId = typeof body.companyId === "string" ? body.companyId : "";
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const role = typeof body.role === "string" ? body.role.trim() : "";
      const agentType = typeof body.agentType === "string" ? body.agentType : "specialist";
      const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt.trim() : "";
      if (!companyId || !name || !role) return NextResponse.json({ error: "Agent name and role are required." }, { status: 400 });
      const { data: agent, error } = await supabase.from("agents").insert({ company_id: companyId, name, role, agent_type: agentType, system_prompt: systemPrompt || `Act as the ${role}. Produce practical, reviewable work aligned to the company goal.`, status: "idle" }).select("id, company_id, name, role, agent_type, status, system_prompt, created_at, updated_at").single();
      if (error) throw error;
      await supabase.from("activity_logs").insert({ company_id: companyId, agent_id: agent.id, event_type: "agent_created", message: `Agent created: ${name}` });
      return NextResponse.json({ agent }, { status: 201 });
    }

    if (action === "toggle-heartbeat") {
      const companyId = typeof body.companyId === "string" ? body.companyId : "";
      const agentId = typeof body.agentId === "string" ? body.agentId : "";
      const enabled = Boolean(body.enabled);
      if (!companyId || !agentId) return NextResponse.json({ error: "Company and agent are required." }, { status: 400 });
      const nextRun = enabled ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null;
      const { data: heartbeat, error } = await supabase.from("heartbeats").upsert({ company_id: companyId, agent_id: agentId, enabled, interval_minutes: 60, next_run_at: nextRun }, { onConflict: "agent_id" }).select("id, agent_id, enabled, interval_minutes, last_run_at, next_run_at").single();
      if (error) throw error;
      await supabase.from("activity_logs").insert({ company_id: companyId, agent_id: agentId, event_type: "heartbeat_updated", message: `Heartbeat ${enabled ? "enabled" : "disabled"}.` });
      return NextResponse.json({ heartbeat });
    }

    if (action === "create-task") {
      const companyId = typeof body.companyId === "string" ? body.companyId : "";
      const agentId = typeof body.agentId === "string" ? body.agentId : "";
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const description = typeof body.description === "string" ? body.description.trim() : "";
      const priority = ["low", "medium", "high", "urgent"].includes(body.priority) ? body.priority : "medium";
      if (!companyId || !agentId || !title || !description) return NextResponse.json({ error: "Agent, title, and description are required." }, { status: 400 });
      const { data: task, error } = await supabase.from("tasks").insert({ company_id: companyId, agent_id: agentId, title, description, priority, status: "todo" }).select(taskSelect).single();
      if (error) throw error;
      await supabase.from("activity_logs").insert({ company_id: companyId, agent_id: agentId, task_id: task.id, event_type: "task_created", message: `Task created: ${title}` });
      return NextResponse.json({ task }, { status: 201 });
    }

    if (action === "delegate") {
      const companyId = typeof body.companyId === "string" ? body.companyId : "";
      const agentId = typeof body.agentId === "string" ? body.agentId : "";
      const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
      if (!companyId || !agentId || !instruction) return NextResponse.json({ error: "Agent and delegation instruction are required." }, { status: 400 });
      const { data: agent, error: agentError } = await supabase.from("agents").select("id, name, role").eq("id", agentId).eq("company_id", companyId).single();
      if (agentError) throw agentError;
      const { data: task, error } = await supabase.from("tasks").insert({ company_id: companyId, agent_id: agentId, title: `Delegated: ${instruction.slice(0, 70)}`, description: instruction, priority: "medium", status: "todo" }).select(taskSelect).single();
      if (error) throw error;
      await supabase.from("activity_logs").insert({ company_id: companyId, agent_id: agentId, task_id: task.id, event_type: "delegated", message: `Work delegated to ${agent.name}: ${instruction}` });
      return NextResponse.json({ task });
    }

    if (action === "approval") {
      const taskId = typeof body.taskId === "string" ? body.taskId : "";
      const decision = body.decision === "approved" ? "approved" : body.decision === "rejected" ? "rejected" : "";
      const comment = typeof body.comment === "string" ? body.comment.trim() : "";
      if (!taskId || !decision) return NextResponse.json({ error: "Task and approval decision are required." }, { status: 400 });
      const { data: task, error: taskError } = await supabase.from("tasks").select("id, company_id, agent_id, title, status").eq("id", taskId).single();
      if (taskError) throw taskError;
      if (task.status !== "review") return NextResponse.json({ error: "Only tasks waiting for review can be approved or rejected." }, { status: 409 });
      const nextStatus = decision === "approved" ? "done" : "blocked";
      const { error: approvalError } = await supabase.from("approvals").insert({ task_id: taskId, decision, comment: comment || null });
      if (approvalError) throw approvalError;
      const { data: updatedTask, error: updateError } = await supabase.from("tasks").update({ status: nextStatus }).eq("id", taskId).select(taskSelect).single();
      if (updateError) throw updateError;
      await supabase.from("activity_logs").insert({ company_id: task.company_id, agent_id: task.agent_id, task_id: taskId, event_type: decision, message: `${decision === "approved" ? "Approved" : "Rejected"}: ${task.title}${comment ? ` — ${comment}` : ""}` });
      if (task.agent_id) await supabase.from("agents").update({ status: "idle" }).eq("id", task.agent_id);
      return NextResponse.json({ task: updatedTask });
    }

    return NextResponse.json({ error: "Unsupported WorkPilot action." }, { status: 400 });
  } catch (error) {
    console.error("WorkPilot action error", error);
    return NextResponse.json({ error: "Unable to complete that WorkPilot action." }, { status: 500 });
  }
}
