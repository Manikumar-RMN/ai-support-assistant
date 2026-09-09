import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/client";

export const runtime = "nodejs";

const OPENAI_MODEL = "gpt-5-mini";

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
      const text = row.content.toLowerCase();
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = typeof body.question === "string" ? body.question.trim() : "";

    if (!question) {
      return NextResponse.json({ error: "Please enter a question." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI is not configured. Add OPENAI_API_KEY to the Vercel project environment variables." },
        { status: 503 },
      );
    }

    const supabase = createSupabaseClient();
    const { data, error: queryError } = await supabase
      .from("knowledge_chunks")
      .select("content, document_id, chunk_index, knowledge_documents(title)");

    if (queryError) throw queryError;

    const matches = rankChunks(question, (data ?? []) as KnowledgeRow[]);

    if (!matches.length) {
      return NextResponse.json({
        answer: "I couldn't find a relevant answer in the connected company knowledge base.",
        sources: [],
      });
    }

    const context = matches
      .map((match, index) => `[Source ${index + 1}] ${match.title}\n${match.content}`)
      .join("\n\n");

    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "You are SupportPilot, a company support knowledge assistant. Answer only from the supplied knowledge context. Do not invent policies, steps, refunds, timelines, or guarantees. If the context does not contain enough information, say so clearly. Give a concise practical answer for a support agent. Never claim an action was taken.",
          },
          {
            role: "user",
            content: `Question:\n${question}\n\nKnowledge context:\n${context}`,
          },
        ],
      }),
    });

    if (!openAIResponse.ok) {
      const details = await openAIResponse.text();
      console.error("OpenAI API error", details);
      return NextResponse.json({ error: "The AI service could not generate an answer." }, { status: 502 });
    }

    const completion = await openAIResponse.json();
    const answer = completion.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      return NextResponse.json({ error: "The AI service returned an empty answer." }, { status: 502 });
    }

    await supabase.from("conversations").insert({ question, answer });

    return NextResponse.json({
      answer,
      sources: matches.map((match) => ({
        title: match.title,
        chunkIndex: match.chunk_index,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Something went wrong while answering the question." }, { status: 500 });
  }
}
