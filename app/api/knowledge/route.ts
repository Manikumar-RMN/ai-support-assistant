import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/client";

export const runtime = "nodejs";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

function splitText(text: string, size = 900) {
  const clean = text.replace(/\r/g, "").trim();
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += size) chunks.push(clean.slice(i, i + size).trim());
  return chunks.filter(Boolean);
}

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

export async function GET() {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("id,title,file_name,description,status,created_at,updated_at,knowledge_chunks(count)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ documents: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Unable to load knowledge documents." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (!title || !text) return NextResponse.json({ error: "Title and document text are required." }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Gemini is not configured. Add GEMINI_API_KEY to the Vercel project environment variables." }, { status: 503 });

    const supabase = createSupabaseClient();
    const { data: doc, error: docError } = await supabase
      .from("knowledge_documents")
      .insert({ title, description, file_name: typeof body.fileName === "string" ? body.fileName.trim() : null, status: "processing" })
      .select("id,title,file_name,description,status,created_at,updated_at")
      .single();
    if (docError) throw docError;

    try {
      const chunks = splitText(text);
      const embeddedChunks = [];
      for (const [chunk_index, content] of chunks.entries()) {
        const embedding = await embedDocument(apiKey, content);
        embeddedChunks.push({ document_id: doc.id, content, chunk_index, embedding });
      }

      const { error: chunkError } = await supabase.from("knowledge_chunks").insert(embeddedChunks);
      if (chunkError) throw chunkError;

      const { data: ready } = await supabase
        .from("knowledge_documents")
        .update({ status: "ready" })
        .eq("id", doc.id)
        .select("id,title,file_name,description,status,created_at,updated_at")
        .single();
      return NextResponse.json({ document: ready ?? doc, chunks: chunks.length, embedded: true }, { status: 201 });
    } catch (error) {
      await supabase.from("knowledge_documents").update({ status: "error" }).eq("id", doc.id);
      throw error;
    }
  } catch (error) {
    console.error("Knowledge ingestion error", error);
    return NextResponse.json({ error: "Unable to add and index the knowledge document." }, { status: 500 });
  }
}
