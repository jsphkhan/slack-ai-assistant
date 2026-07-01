import type { ChatStreamer } from "@slack/web-api";
import OpenAI from "openai";
import {
  type RollDiceArgs,
  rollDice,
  rollDiceDefinition,
} from "./tools/dice.js";

type LLMInput = OpenAI.Responses.ResponseInput;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export async function callLLM(
  streamer: ChatStreamer,
  input: LLMInput,
): Promise<void> {
  const toolCalls: OpenAI.Responses.ResponseFunctionToolCall[] = [];

  // The input already contains the Slack user's message and the system prompt.
  // Streaming lets us forward text to Slack as soon as OpenAI produces it.
  const response = await openai.responses.create({
    model,
    input,
    tools: [rollDiceDefinition],
    tool_choice: "auto",
    stream: true,
  });

  for await (const event of response) {
    // This is the core bridge from OpenAI back to Slack: every text delta is
    // appended to the active Slack stream.
    if (event.type === "response.output_text.delta" && event.delta) {
      await streamer.append({ markdown_text: event.delta });
    }

    // Function calls finish as structured output items. We collect them, show a
    // Slack task update, then run the local tool after the first stream ends.
    if (
      event.type === "response.output_item.done" &&
      event.item.type === "function_call"
    ) {
      toolCalls.push(event.item);

      if (event.item.name === "roll_dice") {
        const args = JSON.parse(event.item.arguments) as RollDiceArgs;
        await streamer.append({
          chunks: [
            {
              type: "task_update",
              id: event.item.call_id,
              title: `Rolling ${args.count}d${args.sides}`,
              status: "in_progress",
            },
          ],
        });
      }
    }
  }

  if (toolCalls.length === 0) {
    return;
  }

  const nextInput: LLMInput = [...input];

  for (const call of toolCalls) {
    if (call.name !== "roll_dice") {
      continue;
    }

    const args = JSON.parse(call.arguments) as RollDiceArgs;
    const result = rollDice(args);

    // Feed the tool result back into OpenAI using the Responses API's expected
    // function_call + function_call_output conversation shape.
    nextInput.push({
      id: call.id,
      call_id: call.call_id,
      type: "function_call",
      name: "roll_dice",
      arguments: call.arguments,
    });

    nextInput.push({
      type: "function_call_output",
      call_id: call.call_id,
      output: JSON.stringify(result),
    });

    const taskTitle = "error" in result ? result.error : result.description;

    await streamer.append({
      chunks: [
        {
          type: "task_update",
          id: call.call_id,
          title: taskTitle ?? "Completed",
          status: "error" in result ? "error" : "complete",
        },
      ],
    });
  }

  // Ask OpenAI to continue now that tool outputs are available. The same Slack
  // streamer is reused, so the final answer appears in the original response.
  await callLLM(streamer, nextInput);
}
