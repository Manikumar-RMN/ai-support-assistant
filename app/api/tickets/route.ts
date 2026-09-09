import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/client";

export const runtime = "nodejs";

const GEMINI_MODEL = "gemini-3.7-flash";

type KnowledgeRow = {
  content: string;
  document_id: string;
  chunk_index: number;
  knowledge_documents: { title: string } | { title: string }[] | null;
};

function rankChunks(query: string, rows: KnowledgeRow[]) {
  const terms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2);

  return rows
    .map((row) => {
      const text = `${row.content} ${row.knowledge_documents ? JSON.stringify(row.knowledge_documents) : ""}`.toLowerCase();
      const score = terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
      const title = Array.isArray(row.knowledge_documents)
        ? row.knowledge_documents[0]?.title
        : row.knowledge_documents?.title;
      return { ...row, score, title: title ?? "Knowledge source" };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

function parseJson(text: string) {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

export async function GET() {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("support_tickets")
      .select("id, customer_name, customer_email, subject, description, category, priority, suggested_response, status, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ tickets: data ?? [] });
  } catch (error) {
    console.error("Ticket list error", error);
    return NextResponse.json({ error: "Unable to load support tickets." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
    const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";

    if (!subject || !description) {
      return NextResponse.json({ error: "Subject and description are required." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini is not configured." }, { status: 503 });
    }

    const supabase = createSupabaseClient();
    const { data: knowledge, error: knowledgeError } = await supabase
      .from("knowledge_chunks")
      .select("content, document_id, chunk_index, knowledge_documents(title)");

    if (knowledgeError) throw knowledgeError;

    const query = `${subject}\n${description}`;
    const matches = rankChunks(query, (knowledge ?? []) as KnowledgeRow[]);
    const context = matches.length
      ? matches.map((match, index) => `[Source ${index + 1}] ${match.title}\n${match.content}`).join("\n\n")
      : "No relevant company knowledge was found.";

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text: "You are SupportPilot, an AI support operations assistant. Analyze the support ticket using only the supplied company knowledge for the suggested response. Classify the ticket using category values billing, technical, account, security, or other. Classify priority as low, medium, high, or urgent. Use urgent only for an active production outage, security concern, or critical business workflow being blocked. If the knowledge does not contain enough information for a response, say that clearly instead of inventing policy. Return valid JSON only with exactly these keys: category, priority, suggested_response. The suggested response should be concise, professional, and ready for a human support agent to review before sending. Do not claim that any action has already been taken."
            }],
          },
          contents: [{
            role: "user",
            parts: [{
              text: `Ticket subject: ${subject}\nCustomer: ${customerName || "Not provided"}\nDescription:\n${description}\n\nCompany knowledge:\n${context}`,
            }],
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 700,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const details = await geminiResponse.text();
      console.error("Gemini ticket error", geminiResponse.status, details);
      if (geminiResponse.status === 429) {
        return NextResponse.json({ error: "The Gemini free-tier limit has been reached temporarily. Please wait and try again later." }, { status: 502 });
      }
      return NextResponse.json({ error: "Gemini could not classify this ticket." }, { status: 502 });
    }

    const completion = await geminiResponse.json();
    const raw = completion.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    if (!raw) throw new Error("Gemini returned no ticket classification.");

    const classification = parseJson(raw);
    const allowedCategories = ["billing", "technical", "account", "security", "other"];
    const allowedPriorities = ["low", "medium", "high", "urgent"];
    const category = allowedCategories.includes(classification.category) ? classification.category : "other";
    const priority = allowedPriorities.includes(classification.priority) ? classification.priority : "medium";
    const suggestedResponse = typeof classification.suggested_response === "string"
      ? classification.suggested_response.trim()
      : "A human support agent should review this ticket and respond using the available company knowledge.";

    const { data: ticket, error: insertError } = await supabase
      .from("support_tickets")
      .insert({
        customer_name: customerName || null,
        customer_email: customerEmail || null,
        subject,
        description,
        category,
        priority,
        suggested_response: suggestedResponse,
        status: "new",
      })
      .select("id, customer_name, customer_email, subject, description, category, priority, suggested_response, status, created_at, updated_at")
      .single();

    if (insertError) throw insertError;
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error("Ticket creation error", error);
    return NextResponse.json({ error: "Something went wrong while creating the support ticket." }, { status: 500 });
  }
}
