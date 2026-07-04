import type { ChatStreamer } from "@slack/web-api";
import OpenAI from "openai";

type LLMInput = OpenAI.Responses.ResponseInput;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export async function callLLM(
  streamer: ChatStreamer,
  input: LLMInput,
): Promise<void> {
  // The input already contains the Slack user's message and the system prompt.
  // Streaming lets us forward text to Slack as soon as OpenAI produces it.
  const response = await openai.responses.create({
    model,
    input,
    stream: true,
  });

  for await (const event of response) {
    // This is the core bridge from OpenAI back to Slack: every text delta is
    // appended to the active Slack stream.
    if (event.type === "response.output_text.delta" && event.delta) {
      await streamer.append({ markdown_text: event.delta });
    }
  }
}
