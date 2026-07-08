import "dotenv/config";
import { App, LogLevel } from "@slack/bolt";
import { callLLM } from "./agent/llm-caller.js";
import { optionalNumberEnv, requiredEnv } from "./env.js";
import { registerAssistantListeners } from "./listeners/assistant/index.js";

const botToken = requiredEnv("SLACK_BOT_TOKEN");
const signingSecret = requiredEnv("SLACK_SIGNING_SECRET");
const appToken = process.env.SLACK_APP_TOKEN;
const socketMode = Boolean(appToken);

const app = new App({
  token: botToken,
  signingSecret,
  socketMode,
  appToken: appToken ?? undefined,
  port: socketMode ? undefined : optionalNumberEnv("PORT", 3000),
  logLevel: LogLevel.INFO,
});

/** 
 * Temporary middleware to inspect incoming payloads and quickly 
 * identify which Slack surface triggered them:
*/
// app.use(async ({ payload, logger, next }) => {
//   logger.info("debug payload", {
//     type: "type" in payload ? payload.type : undefined,
//     subtype: "subtype" in payload ? payload.subtype : undefined,
//     channelType: "channel_type" in payload ? payload.channel_type : undefined,
//     channel: "channel" in payload ? payload.channel : undefined,
//     threadTs: "thread_ts" in payload ? payload.thread_ts : undefined,
//     ts: "ts" in payload ? payload.ts : undefined,
//     user: "user" in payload ? payload.user : undefined,
//     botId: "bot_id" in payload ? payload.bot_id : undefined,
//     text: "text" in payload ? payload.text : undefined,
//   });
//   await next();
// });

// Keep this middleware near the top so debugging event delivery is easy when
// Slack changes the shape of Agent / Assistant events.
// app.use(async ({ payload, logger, next }) => {
//   logger.info("slack payload received", {
//     type: payload.type,
//     subtype: "subtype" in payload ? payload.subtype : undefined,
//     channelType: "channel_type" in payload ? payload.channel_type : undefined,
//     hasThreadTs: "thread_ts" in payload && Boolean(payload.thread_ts)
//   });

//   await next();
// });

// This still supports Slack's older Assistant thread events. The current
// manifest uses agent_view, so root Agent panel messages are handled below.
registerAssistantListeners(app);

// In agent_view, Slack can open the app's Messages tab before any user prompt.
// We log it as a lifecycle signal; responses are produced from message.im.
// app.event("app_home_opened", async ({ event, logger }) => {
//   logger.info("app_home_opened received", {
//     channel: event.channel,
//     tab: event.tab,
//     user: event.user,
//   });
// });

// Handles the current Slack Agent messaging experience. Root messages arrive as
// message.im without thread_ts, so the older Assistant class does not handle
// them; this direct listener is the active path for first user prompts.
app.message(async ({ message, logger, say, sayStream, setStatus }) => {
  // Only answer direct app messages. Channel mentions are handled separately
  // below, and bot/subtype messages are ignored to avoid response loops.
  if (!("channel_type" in message) || message.channel_type !== "im") {
    return;
  }

  if ("bot_id" in message && message.bot_id) {
    return;
  }

  if ("subtype" in message && message.subtype !== undefined) {
    return;
  }

  if (!("text" in message) || !message.text) {
    return;
  }

  const text = message.text.trim();

  if (!text) {
    return;
  }

  logger.info("agent message received", {
    channel: message.channel,
    threadTs: "thread_ts" in message ? message.thread_ts : undefined,
    user: "user" in message ? message.user : undefined,
    text,
  });

  try {
    await setStatus("thinking...");

    // sayStream() binds OpenAI's streamed output to this Slack conversation.
    // For root Agent messages, Bolt uses the user's message as the thread root.
    const streamer = sayStream();
    await callLLM(streamer, [
      {
        role: "system",
        content:
          "You are a concise Slack AI assistant. Answer clearly, ask for missing details when needed, and format responses for Slack markdown.",
      },
      {
        role: "user",
        content: text,
      },
    ]);
    await streamer.stop();
    await setStatus("");
  } catch (error) {
    logger.error("agent LLM call failed", error);
    await setStatus("");
    await say({
      thread_ts: "thread_ts" in message ? message.thread_ts : undefined,
      text: "I could not complete that request. Check the app logs for details.",
    });
  }
});

/** 
 * Handles app mentions.
 * FOr example if the user says "@slack-ai-assistant" in a channel, this event will be triggered.
 * We then respond with a message that explains that the assistant is an agent and how to open it.
 * This is a fallback for when the user does not know how to use the assistant.
*/
app.event("app_mention", async ({ event, say, logger }) => {
  const text = event.text.replace(/<@[^>]+>/g, "").trim();
  const threadTs = event.thread_ts ?? event.ts;

  logger.info("app_mention received", {
    channel: event.channel,
    threadTs,
    text,
  });

  await say({
    thread_ts: threadTs,
    text: "Slack AI Assistant is an agent. So you can communicate with it via the Agents panel. Open the assistant from Slack's Agents panel for the full AI assistant experience. See to your top right for the Agents panel.",
  });
});

async function main() {
  const auth = await app.client.auth.test({ token: botToken });
  await app.start();

  if (socketMode) {
    console.log(
      `Slack AI Assistant is running in Socket Mode as ${auth.user}.`,
    );
  } else {
    console.log(
      `Slack AI Assistant is running on port ${process.env.PORT ?? 3000}.`,
    );
  }
}

main().catch((error) => {
  console.error("Failed to start Slack AI Assistant:", error);
  process.exit(1);
});
