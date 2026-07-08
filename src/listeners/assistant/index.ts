import { type App, Assistant } from "@slack/bolt";
import { callLLM } from "../../agent/llm-caller.js";

export function registerAssistantListeners(app: App): void {
  // Legacy Assistant thread support. Slack's newer agent_view sends initial
  // prompts through the direct message.im handler in src/app.ts.
  const assistant = new Assistant({
    threadStarted: async ({
      event,
      logger,
      saveThreadContext,
      say,
      setSuggestedPrompts,
    }) => {
      logger.info("assistant_thread_started", {
        channel: event.assistant_thread.channel_id,
        threadTs: event.assistant_thread.thread_ts,
        user: event.assistant_thread.user_id,
        context: event.assistant_thread.context,
      });

      await saveThreadContext();
      await say("Hi, I am your Slack AI assistant. What can I help with?");

      await setSuggestedPrompts({
        title: "Try asking",
        prompts: [
          {
            title: "Summarize this channel",
            message: "Summarize the current channel context.",
          },
          {
            title: "Draft a reply",
            message: "Draft a concise reply for this discussion.",
          }
        ],
      });
    },

    threadContextChanged: async ({ event, logger, saveThreadContext }) => {
      logger.info("assistant_thread_context_changed", {
        channel: event.assistant_thread.channel_id,
        threadTs: event.assistant_thread.thread_ts,
        context: event.assistant_thread.context,
      });

      await saveThreadContext();
    },

    userMessage: async ({
      message,
      logger,
      say,
      sayStream,
      setStatus,
      setTitle,
    }) => {
      if (message.subtype !== undefined) {
        return;
      }

      if (!("text" in message) || !message.text) {
        return;
      }

      const text = message.text.trim();

      if (!text) {
        return;
      }

      logger.info("assistant user message", {
        channel: message.channel,
        threadTs: "thread_ts" in message ? message.thread_ts : undefined,
        user: "user" in message ? message.user : undefined,
        text,
      });

      await setTitle(text.slice(0, 80));
      await setStatus("thinking...");

      try {
        const threadTs =
          "thread_ts" in message && message.thread_ts ? message.thread_ts : message.ts;
        const replies = await app.client.conversations.replies({
          channel: message.channel,
          ts: threadTs,
          limit: 50,
        });
        const conversationHistory =
          replies.messages?.map((threadMessage) => ({
            ts: threadMessage.ts,
            user: "user" in threadMessage ? threadMessage.user : undefined,
            botId: "bot_id" in threadMessage ? threadMessage.bot_id : undefined,
            text: "text" in threadMessage ? threadMessage.text : undefined,
            subtype:
              "subtype" in threadMessage ? threadMessage.subtype : undefined,
          })) ?? [];
        // logger.info("assistant thread conversation history", {
        //   channel: message.channel,
        //   threadTs,
        //   count: conversationHistory.length,
        //   messages: conversationHistory,
        // });
        const contextEntries = conversationHistory
          .filter(
            (threadMessage) =>
              threadMessage.text &&
              threadMessage.ts !== message.ts &&
              threadMessage.subtype === undefined,
          )
          .slice(-10)
          .map((threadMessage) => ({
            speaker: threadMessage.botId !== undefined ? "assistant" : "user",
            text: threadMessage.text,
          }));
        const contextBlock = contextEntries
          .map((entry) => `${entry.speaker}: ${entry.text}`)
          .join("\n");
        logger.info("assistant LLM context prepared", {
          channel: message.channel,
          threadTs,
          contextCount: contextEntries.length,
          context: contextBlock,
        });

        // Threaded Assistant messages use the same OpenAI-to-Slack streaming
        // bridge as the newer agent_view message handler.
        const streamer = sayStream();
        await callLLM(streamer, [
          {
            role: "system",
            content:
              "You are a concise Slack AI assistant. Answer clearly, ask for missing details when needed, and format responses for Slack markdown.",
          },
          ...(contextBlock
            ? [
                {
                  role: "system" as const,
                  content: `Recent thread context (oldest to newest):\n${contextBlock}`,
                },
              ]
            : []),
          {
            role: "user",
            content: text,
          },
        ]);
        await streamer.stop();
        await setStatus("");
      } catch (error) {
        logger.error("assistant LLM call failed", error);
        await setStatus("");
        await say(
          "I could not complete that request. Check the app logs for details.",
        );
      }
    },
  });

  app.assistant(assistant);
}
