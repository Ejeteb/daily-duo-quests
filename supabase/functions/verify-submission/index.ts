// AI Strict Judge for Daily Duo submissions.
// Receives a submission_id, fetches the row + quest, calls Lovable AI Gateway
// with structured tool-calling to get {verdict, reason}, and updates the
// submission. On rejection, deletes media + row and inserts a nudge so the
// partner sees a "rejected" toast.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function getSignedUrl(path: string): Promise<string | null> {
  const { data } = await admin.storage
    .from("duo-media")
    .createSignedUrl(path, 60 * 5);
  return data?.signedUrl ?? null;
}

async function fetchAsBase64(url: string): Promise<{ b64: string; mime: string }> {
  const res = await fetch(url);
  const mime = res.headers.get("content-type") ?? "application/octet-stream";
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return { b64: btoa(bin), mime };
}

async function judge(opts: {
  prompt: string;
  mediaType: "image" | "audio" | "text";
  mediaUrl?: string;
  textContent?: string;
}) {
  const systemPrompt = `You are the Strict Judge for "Daily Duo", a relationship game where two partners must complete a shared daily quest with a photo, voice note, or short text. Be FAIR but STRICT — only approve uploads that clearly satisfy the quest. Selfies, blurry shots, and obvious unrelated content for visual quests should be rejected. For audio quests, audio that is silent or unrelated should be rejected. For text quests, accept short answers if they make a sincere attempt; reject empty/gibberish/spam.`;

  const userParts: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `Quest: "${opts.prompt}"\n\nDecide if the partner's submission satisfies the quest.`,
    },
  ];

  if (opts.mediaType === "image" && opts.mediaUrl) {
    const { b64, mime } = await fetchAsBase64(opts.mediaUrl);
    userParts.push({
      type: "image_url",
      image_url: { url: `data:${mime};base64,${b64}` },
    });
  } else if (opts.mediaType === "audio" && opts.mediaUrl) {
    const { b64, mime } = await fetchAsBase64(opts.mediaUrl);
    userParts.push({
      type: "input_audio",
      input_audio: { data: b64, format: mime.includes("wav") ? "wav" : "mp3" },
    });
  } else if (opts.mediaType === "text") {
    userParts.push({
      type: "text",
      text: `Partner submitted text:\n"""${opts.textContent ?? ""}"""`,
    });
  }

  const body = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userParts },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "submit_verdict",
          description: "Return your verdict on whether the submission satisfies the quest.",
          parameters: {
            type: "object",
            properties: {
              verdict: { type: "string", enum: ["approved", "rejected"] },
              reason: {
                type: "string",
                description: "One short friendly sentence explaining the decision.",
              },
            },
            required: ["verdict", "reason"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "submit_verdict" } },
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI gateway ${res.status}: ${txt}`);
  }
  const data = await res.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error("No tool call returned");
  const args = JSON.parse(tc.function.arguments) as {
    verdict: "approved" | "rejected";
    reason: string;
  };
  return args;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { submission_id } = await req.json();
    if (!submission_id) throw new Error("submission_id required");

    const { data: sub, error: subErr } = await admin
      .from("submissions")
      .select("*")
      .eq("id", submission_id)
      .maybeSingle();
    if (subErr || !sub) throw new Error("submission not found");

    const { data: dq } = await admin
      .from("daily_quests")
      .select("quest_id")
      .eq("user_id", sub.user_id)
      .eq("quest_date", sub.quest_date)
      .maybeSingle();
    const { data: quest } = await admin
      .from("quests")
      .select("prompt, accepts")
      .eq("id", dq?.quest_id)
      .maybeSingle();
    if (!quest) throw new Error("quest not found");

    let mediaUrl: string | undefined;
    if (sub.media_type !== "text" && sub.media_url) {
      mediaUrl = (await getSignedUrl(sub.media_url)) ?? undefined;
    }

    const result = await judge({
      prompt: quest.prompt,
      mediaType: sub.media_type as "image" | "audio" | "text",
      mediaUrl,
      textContent: sub.text_content ?? undefined,
    });

    if (result.verdict === "approved") {
      await admin
        .from("submissions")
        .update({ verdict: "approved" })
        .eq("id", submission_id);
    } else {
      // delete media if any, then row
      if (sub.media_type !== "text" && sub.media_url) {
        await admin.storage.from("duo-media").remove([sub.media_url]);
      }
      await admin.from("submissions").delete().eq("id", submission_id);
      // notify partner
      await admin.from("nudges").insert({
        user_id: sub.user_id,
        from_slot: sub.slot,
        to_slot: sub.slot === "a" ? "b" : "a",
        kind: "rejection",
        payload: { reason: result.reason, slot: sub.slot },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-submission error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
