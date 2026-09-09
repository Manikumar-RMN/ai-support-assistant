"use client";

import { useEffect, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";

export default function SessionButton() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setEmail(session?.user?.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!email) return null;

  return (
    <button
      onClick={async () => {
        const supabase = createSupabaseClient();
        await supabase.auth.signOut();
        window.location.href = "/login";
      }}
      style={{ position: "fixed", right: 18, top: 16, zIndex: 50, border: "1px solid #dce3de", background: "rgba(255,255,255,.94)", color: "#536057", borderRadius: 999, padding: "7px 11px", fontSize: 10, boxShadow: "0 5px 20px rgba(20,40,28,.08)" }}
      title={email}
    >
      Sign out
    </button>
  );
}
