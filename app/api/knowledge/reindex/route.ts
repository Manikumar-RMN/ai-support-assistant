import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/client";

export const runtime = "nodejs";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

async function embedDocument(apiKey: string, text: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIMENSIONS,
      taskType: "RETRIEVAL_DOCUMENT",
    }),
  });
  if (!response.ok) throw new Error(`Embedding request failed: ${response.status}`);
  const data = await response.json();
  const values = data.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) throw new Error("Invalid embedding response.");
  return values as number[];
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const documentId = typeof body.documentId === "string" ? body.documentId : "";
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Gemini is not configured." }, { status: 503 });

    const supabase = createSupabaseClient();
    let query = supabase.from("knowledge_chunks").select("id,content,document_id").order("chunk_index", { ascending: true });
    if (documentId) query = query.eq("document_id", documentId);
    const { data: chunks, error } = await query;
    if (error) throw error;
    if (!chunks?.length) return NextResponse.json({ error: "No knowledge chunks found to index." }, { status: 404 });

    for (const chunk of chunks) {
      const embedding = await embedDocument(apiKey, chunk.content);
      const { error: updateError } = await supabase.from("knowledge_chunks").update({ embedding }).eq("id", chunk.id);
      if (updateError) throw updateError;
    }

    return NextResponse.json({ indexed: chunks.length });
  } catch (error) {
    console.error("Knowledge reindex error", error);
    return NextResponse.json({ error: "Unable to reindex knowledge." }, { status: 500 });
  }
}
