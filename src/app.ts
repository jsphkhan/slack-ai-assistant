import "dotenv/config";
import { App, LogLevel } from "@slack/bolt";
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

registerAssistantListeners(app);

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
