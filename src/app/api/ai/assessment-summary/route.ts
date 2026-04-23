import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SUMMARY_SYSTEM } from "~/lib/ai/coach";

export const runtime = "nodejs";

const SummarySchema = z.object({
  patient: z.string(),
  clinician: z.string(),
});

interface RequestBody {
  model?: string;
  assessment: Record<string, unknown>;
  prior_assessment?: Record<string, unknown> | null;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.assessment) {
    return NextResponse.json(
      { error: "assessment required" },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.parse({
      model: body.model ?? "claude-opus-4-7",
      max_tokens: 800,
      system: [
        {
          type: "text",
          text: SUMMARY_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: { format: zodOutputFormat(SummarySchema) },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                assessment: body.assessment,
                prior_assessment: body.prior_assessment ?? null,
              }),
            },
          ],
        },
      ],
    });
    if (!response.parsed_output) {
      return NextResponse.json(
        { error: "No summary returned" },
        { status: 502 },
      );
    }
    return NextResponse.json({ result: response.parsed_output });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
