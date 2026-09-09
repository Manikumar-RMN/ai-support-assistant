import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/client";

export const runtime = "nodejs";
const GEMINI_MODEL = "gemini-3.7-flash";
type KnowledgeRow = { content: string; document_id: string; chunk_index: number; knowledge_documents: { title: string } | { title: string }[] | null };
function rankChunks(query: string, rows: KnowledgeRow[]) {
  const terms = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((term) => term.length > 2);
  return rows.map((row) => { const text = `${row.content} ${row.knowledge_documents ? JSON.stringify(row.knowledge_documents) : ""}`.toLowerCase(); const score = terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0); const title = Array.isArray(row.knowledge_documents) ? row.knowledge_documents[0]?.title : row.knowledge_documents?.title; return { ...row, score, title: title ?? "Knowledge source" }; }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
}
export async function POST(request: Request) {
  const started = Date.now();
  let taskId = ""; let supabase: ReturnType<typeof createSupabaseClient> | null = null;
  try {
    const body = await request.json(); taskId = typeof body.taskId === "string" ? body.taskId : "";
    if (!taskId) return NextResponse.json({ error: "Task is required." }, { status: 400 });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Gemini is not configured." }, { status: 503 });
    supabase = createSupabaseClient();
    const { data: task, error: taskError } = await supabase.from("tasks").select("id, company_id, agent_id, title, description, priority, status, agents(name, role, system_prompt)").eq("id", taskId).single();
    if (taskError) throw taskError;
    const agent = Array.isArray(task.agents) ? task.agents[0] : task.agents;
    if (!agent) return NextResponse.json({ error: "Assign an agent before running the task." }, { status: 400 });
    if (task.status === "running") return NextResponse.json({ error: "This task is already running." }, { status: 409 });
    await supabase.from("tasks").update({ status: "running" }).eq("id", taskId);
    await supabase.from("agents").update({ status: "working" }).eq("id", task.agent_id);
    await supabase.from("activity_logs").insert({ company_id: task.company_id, agent_id: task.agent_id, task_id: task.id, event_type: "agent_started", message: `${agent.name} started work on ${task.title}` });
    const [{ data: company, error: companyError }, { data: knowledge, error: knowledgeError }, { data: memories, error: memoryError }] = await Promise.all([
      supabase.from("companies").select("name, goal").eq("id", task.company_id).single(),
      supabase.from("knowledge_chunks").select("content, document_id, chunk_index, knowledge_documents(title)"),
      supabase.from("agent_memory").select("content, memory_type").eq("agent_id", task.agent_id).order("created_at", { ascending: false }).limit(5),
    ]);
    if (companyError) throw companyError; if (knowledgeError) throw knowledgeError; if (memoryError) throw memoryError;
    const matches = rankChunks(`${task.title}\n${task.description}`, (knowledge ?? []) as KnowledgeRow[]);
    const context = matches.length ? matches.map((match, index) => `[Source ${index + 1}] ${match.title}\n${match.content}`).join("\n\n") : "No directly relevant knowledge was found.";
    const memoryContext = (memories ?? []).length ? (memories ?? []).map((m) => `- ${m.content}`).join("\n") : "No prior memory.";
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify({ system_instruction: { parts: [{ text: `You are ${agent.name}, the ${agent.role} at ${company.name}. ${agent.system_prompt ?? "Complete the assigned task carefully and practically."} Work toward this company goal: ${company.goal}. Produce a useful work output for a human to review. Do not claim external actions were taken. If information is missing, say what is missing. Use supplied company knowledge when relevant and do not invent policy.` }] }, contents: [{ role: "user", parts: [{ text: `Task: ${task.title}\n\nTask description:\n${task.description}\n\nRelevant company knowledge:\n${context}\n\nRecent agent memory:\n${memoryContext}` }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 900 } }) });
    if (!geminiResponse.ok) {
      const details = await geminiResponse.text(); console.error("Gemini agent error", geminiResponse.status, details);
      await supabase.from("tasks").update({ status: "blocked", result: "AI execution failed. Check the Gemini API configuration or free-tier limit." }).eq("id", taskId);
      await supabase.from("agents").update({ status: "idle" }).eq("id", task.agent_id);
      return NextResponse.json({ error: geminiResponse.status === 429 ? "The Gemini free-tier limit has been reached temporarily." : "Gemini could not execute this task." }, { status: 502 });
    }
    const completion = await geminiResponse.json();
    const result = completion.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("").trim();
    if (!result) throw new Error("Gemini returned an empty task result.");
    const usage = completion.usageMetadata ?? {};
    const inputTokens = Number(usage.promptTokenCount ?? 0); const outputTokens = Number(usage.candidatesTokenCount ?? 0);
    const duration = Date.now() - started;
    const { data: updatedTask, error: updateError } = await supabase.from("tasks").update({ status: "review", result }).eq("id", taskId).select("id, company_id, agent_id, title, description, priority, status, result, created_at, updated_at, agents(name, role)").single();
    if (updateError) throw updateError;
    await supabase.from("agents").update({ status: "review" }).eq("id", task.agent_id);
    await supabase.from("agent_memory").insert({ company_id: task.company_id, agent_id: task.agent_id, task_id: task.id, memory_type: "task_result", content: `${task.title}: ${result.slice(0, 2000)}` });
    await supabase.from("agent_runs").insert({ company_id: task.company_id, agent_id: task.agent_id, task_id: task.id, model: GEMINI_MODEL, status: "completed", input_tokens: inputTokens, output_tokens: outputTokens, estimated_cost: 0, duration_ms: duration });
    await supabase.from("activity_logs").insert({ company_id: task.company_id, agent_id: task.agent_id, task_id: task.id, event_type: "agent_completed", message: `${agent.name} completed ${task.title}; waiting for human review.` });
    return NextResponse.json({ task: updatedTask, sources: matches.map((match) => match.title).filter((title, index, all) => all.indexOf(title) === index), usage: { inputTokens, outputTokens, durationMs: duration } });
  } catch (error) {
    console.error("Agent execution error", error);
    if (supabase && taskId) { try { await supabase.from("tasks").update({ status: "blocked", result: "Execution stopped unexpectedly. Review the task and run it again." }).eq("id", taskId); } catch {} }
    return NextResponse.json({ error: "Something went wrong while running the AI agent." }, { status: 500 });
  }
}
