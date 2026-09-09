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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini is not configured. Add GEMINI_API_KEY to the Vercel project environment variables." },
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
            parts: [
              {
                text:
                  "You are SupportPilot, a company support knowledge assistant. Answer only from the supplied knowledge context. Do not invent policies, steps, refunds, timelines, or guarantees. If the context does not contain enough information, say so clearly. Give a concise practical answer for a support agent. Never claim an action was taken.",
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Question:\n${question}\n\nKnowledge context:\n${context}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 400,
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const details = await geminiResponse.text();
      console.error("Gemini API error", geminiResponse.status, details);

      if (geminiResponse.status === 400 || geminiResponse.status === 401 || geminiResponse.status === 403) {
        return NextResponse.json(
          { error: "The Gemini API key was rejected. Check the Vercel secret and make sure the Gemini API key is active." },
          { status: 502 },
        );
      }

      if (geminiResponse.status === 429) {
        return NextResponse.json(
          { error: "The Gemini free-tier limit has been reached temporarily. Please wait and try again later." },
          { status: 502 },
        );
      }

      return NextResponse.json(
        { error: "The Gemini AI service could not generate an answer. Check the deployment logs for the API error." },
        { status: 502 },
      );
    }

    const completion = await geminiResponse.json();
    const answer = completion.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    if (!answer) {
      return NextResponse.json({ error: "The Gemini AI service returned an empty answer." }, { status: 502 });
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
