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

app.use(async ({ payload, logger, next }) => {
  logger.info("slack payload received", {
    type: payload.type,
    subtype: "subtype" in payload ? payload.subtype : undefined,
    channelType: "channel_type" in payload ? payload.channel_type : undefined,
    hasThreadTs: "thread_ts" in payload && Boolean(payload.thread_ts),
    message: "message" in payload ? payload.message : undefined,
  });

  await next();
});

registerAssistantListeners(app);

app.event("app_home_opened", async ({ event, logger }) => {
  logger.info("app_home_opened received", {
    channel: event.channel,
    tab: event.tab,
    user: event.user,
  });
});

app.message(async ({ message, logger, say, sayStream, setStatus }) => {
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
    text: "Open the assistant from Slack's Agents panel for the full AI assistant experience.",
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
