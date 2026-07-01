import "dotenv/config";

const required = ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET", "OPENAI_API_KEY"];
const localOnly = ["SLACK_APP_TOKEN"];

const missing = required.filter((name) => !process.env[name]);
const missingLocal = localOnly.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(
    `Missing required environment variables: ${missing.join(", ")}`,
  );
  process.exit(1);
}

if (missingLocal.length > 0) {
  console.warn(
    `Missing ${missingLocal.join(", ")}. The app will use HTTP mode instead of Socket Mode.`,
  );
}

console.log("Environment looks ready.");
