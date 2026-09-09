import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/client";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = createSupabaseClient();
    const [{ data: company, error: companyError }, { data: agents, error: agentsError }, { data: tasks, error: tasksError }, { data: activity, error: activityError }] = await Promise.all([
      supabase.from("companies").select("id, name, description, goal, created_at, updated_at").order("created_at", { ascending: true }).limit(1).maybeSingle(),
      supabase.from("agents").select("id, company_id, name, role, agent_type, status, created_at, updated_at").order("created_at", { ascending: true }),
      supabase.from("tasks").select("id, company_id, agent_id, title, description, priority, status, result, created_at, updated_at, agents(name, role)").order("created_at", { ascending: false }).limit(30),
      supabase.from("activity_logs").select("id, company_id, agent_id, task_id, event_type, message, created_at, agents(name)").order("created_at", { ascending: false }).limit(30),
    ]);

    if (companyError) throw companyError;
    if (agentsError) throw agentsError;
    if (tasksError) throw tasksError;
    if (activityError) throw activityError;

    return NextResponse.json({ company, agents: agents ?? [], tasks: tasks ?? [], activity: activity ?? [] });
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

    if (action === "create-task") {
      const companyId = typeof body.companyId === "string" ? body.companyId : "";
      const agentId = typeof body.agentId === "string" ? body.agentId : "";
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const description = typeof body.description === "string" ? body.description.trim() : "";
      const priority = typeof body.priority === "string" ? body.priority : "medium";
      if (!companyId || !agentId || !title || !description) return NextResponse.json({ error: "Agent, title, and description are required." }, { status: 400 });

      const { data: task, error } = await supabase.from("tasks").insert({ company_id: companyId, agent_id: agentId, title, description, priority, status: "todo" }).select("id, company_id, agent_id, title, description, priority, status, result, created_at, updated_at, agents(name, role)").single();
      if (error) throw error;
      await supabase.from("activity_logs").insert({ company_id: companyId, agent_id: agentId, task_id: task.id, event_type: "task_created", message: `Task created: ${title}` });
      return NextResponse.json({ task }, { status: 201 });
    }

    if (action === "approval") {
      const taskId = typeof body.taskId === "string" ? body.taskId : "";
      const decision = body.decision === "approved" ? "approved" : body.decision === "rejected" ? "rejected" : "";
      const comment = typeof body.comment === "string" ? body.comment.trim() : "";
      if (!taskId || !decision) return NextResponse.json({ error: "Task and approval decision are required." }, { status: 400 });

      const { data: task, error: taskError } = await supabase.from("tasks").select("id, company_id, agent_id, title, status").eq("id", taskId).single();
      if (taskError) throw taskError;
      const nextStatus = decision === "approved" ? "done" : "blocked";
      const { error: approvalError } = await supabase.from("approvals").insert({ task_id: taskId, decision, comment: comment || null });
      if (approvalError) throw approvalError;
      const { data: updatedTask, error: updateError } = await supabase.from("tasks").update({ status: nextStatus }).eq("id", taskId).select("id, company_id, agent_id, title, description, priority, status, result, created_at, updated_at, agents(name, role)").single();
      if (updateError) throw updateError;
      await supabase.from("activity_logs").insert({ company_id: task.company_id, agent_id: task.agent_id, task_id: taskId, event_type: decision, message: `${decision === "approved" ? "Approved" : "Rejected"}: ${task.title}` });
      if (task.agent_id) await supabase.from("agents").update({ status: "idle" }).eq("id", task.agent_id);
      return NextResponse.json({ task: updatedTask });
    }

    return NextResponse.json({ error: "Unsupported WorkPilot action." }, { status: 400 });
  } catch (error) {
    console.error("WorkPilot action error", error);
    return NextResponse.json({ error: "Unable to complete that WorkPilot action." }, { status: 500 });
  }
}
