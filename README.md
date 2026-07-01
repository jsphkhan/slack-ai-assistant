# Slack AI Assistant

A Slack AI assistant built with Bolt for JavaScript, inspired by Slack's `slack-samples/bolt-js-assistant-template`.

It includes:

- Slack `Assistant` handlers for the Agents / AI Apps experience
- Suggested prompts when a new assistant thread starts
- OpenAI Responses API streaming into Slack
- A sample `roll_dice` tool call with Slack task updates
- A Slack app manifest configured for Socket Mode local development

## Requirements

- Node.js 20 or newer
- A Slack workspace where you can install apps
- A Slack app-level token with `connections:write`
- An OpenAI API key

## 1. Install dependencies

```bash
cd /Users/joseph.khan/htdocs/my-projects/slack-ai-assistant
npm install
```

## 2. Create your Slack app

Option A, with Slack CLI:

```bash
slack login
slack install
```

Option B, from the Slack dashboard:

1. Open [api.slack.com/apps/new](https://api.slack.com/apps/new).
2. Choose **From an app manifest**.
3. Select your workspace.
4. Paste the contents of `manifest.json`.
5. Create the app and install it to the workspace.

## 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in:

- `SLACK_BOT_TOKEN`: OAuth & Permissions -> Bot User OAuth Token (`xoxb-...`)
- `SLACK_SIGNING_SECRET`: Basic Information -> Signing Secret
- `SLACK_APP_TOKEN`: Basic Information -> App-Level Tokens, with `connections:write` (`xapp-...`)
- `OPENAI_API_KEY`: your OpenAI API key
- `OPENAI_MODEL`: optional, defaults to `gpt-4o-mini`

After adding scopes or events in Slack, reinstall the app to your workspace.

## 4. Start the assistant

```bash
npm run dev
```

For a non-watch process:

```bash
npm start
```

With `SLACK_APP_TOKEN` set, the app runs in Socket Mode, so you do not need a public request URL for local development.

## 5. Talk to the assistant in Slack

Use Slack desktop's Agents / AI Apps entry point, not only the classic app DM:

1. Open Slack.
2. Open the Agents / AI assistant panel.
3. Select **Slack AI Assistant**.
4. Send a message or choose a suggested prompt.

You can also mention the bot in a channel. The mention handler replies with a pointer to use the Agents panel for the full assistant flow.

## Useful commands

```bash
npm run typecheck
npm run lint
npm run format
```

## Project structure

```text
src/app.ts                         Bolt app startup
src/listeners/assistant/index.ts   Slack Assistant handlers
src/agent/llm-caller.ts            OpenAI streaming and tool-call loop
src/agent/tools/dice.ts            Example assistant tool
manifest.json                      Slack app configuration
.env.example                       Local environment template
```

## Where to customize

- Change suggested prompts in `src/listeners/assistant/index.ts`.
- Change the assistant system prompt in `src/listeners/assistant/index.ts`.
- Add real business tools under `src/agent/tools/`.
- Replace or extend `callLLM()` in `src/agent/llm-caller.ts` for retrieval, memory, or API integrations.

## References
- Slack Apps https://api.slack.com/apps
- Slack AI Assistant doc https://docs.slack.dev/tools/bolt-js/tutorials/ai-assistant
