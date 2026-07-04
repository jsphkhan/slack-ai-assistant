# Slack AI Assistant

A Slack AI assistant built with Node.js, Bolt for JavaScript, Slack Socket Mode,
and the OpenAI Responses API.

The app is configured for Slack's current `agent_view` experience, so users can
open the assistant from Slack's AI Agents / Agents panel, send prompts, choose
suggested prompts, and receive streamed AI responses inside Slack.

A detailed article has also been published covering the full build process:
[Build a Slack AI Assistant Using NodeJS](https://www.josephkhan.site/blog/build-slack-ai-assistant-nodejs/).

## What this project includes

- Slack `agent_view` manifest configuration for the AI Agents experience
- Socket Mode local development, so no public request URL is required
- Direct `message.im` handling for Slack Agent panel messages
- Legacy Bolt `Assistant` thread support for older assistant-thread events
- OpenAI Responses API streaming into Slack through `sayStream()`
- A sample `roll_dice` function tool with Slack task updates
- Suggested prompts configured in the Slack app manifest
- Environment validation helper for required Slack and OpenAI credentials

## Requirements

- Node.js 20 or newer
- A Slack workspace where you can create and install apps
- A Slack bot token with the scopes from `manifest.json`
- A Slack app-level token with `connections:write`
- An OpenAI API key

## Install dependencies

```bash
npm install
```

## Create and install the Slack app

### Option A: Slack CLI

```bash
slack login
slack install
```

### Option B: Slack app dashboard

1. Open [api.slack.com/apps/new](https://api.slack.com/apps/new).
2. Choose **From an app manifest**.
3. Select your Slack workspace.
4. Paste the contents of `manifest.json`.
5. Create the app and install it to the workspace.

After changing scopes, events, or `agent_view` settings, reinstall the app so
Slack applies the updated manifest.

## Configure environment variables

```bash
cp .env.example .env
```

Fill in:

- `SLACK_BOT_TOKEN`: OAuth & Permissions -> Bot User OAuth Token (`xoxb-...`)
- `SLACK_APP_TOKEN`: Basic Information -> App-Level Tokens -> token with `connections:write` (`xapp-...`)
- `SLACK_SIGNING_SECRET`: Basic Information -> Signing Secret
- `OPENAI_API_KEY`: OpenAI API key
- `OPENAI_MODEL`: optional, defaults to `gpt-4o-mini`
- `PORT`: optional, only used when Socket Mode is disabled

Validate the local environment:

```bash
npx tsx scripts/verify-env.ts
```

## Start the assistant

Development mode with file watching:

```bash
npm run dev
```

Single process mode:

```bash
npm start
```

When `SLACK_APP_TOKEN` is present, the app runs in Socket Mode and connects to
Slack directly. You do not need ngrok or a public HTTP endpoint for local
development.

## Use the assistant in Slack

1. Open Slack.
2. Open the AI Agents / Agents panel.
3. Select **Slack AI Assistant**.
4. Send a message or select one of the suggested prompts.

The current Agent panel sends first prompts as `message.im` events without a
`thread_ts`. This project handles those in `src/app.ts`. Follow-up messages may
arrive as threaded messages, which are still supported by the legacy Assistant
listener.

You can also mention the bot in a channel. The channel mention handler replies
with a pointer to use the Agents panel for the full assistant experience.

## Useful commands

```bash
npm run typecheck
npm run lint
npm run format
npx tsx scripts/verify-env.ts
```

## Project structure

```text
manifest.json                      Slack app manifest with agent_view, scopes, events, and suggested prompts
package.json                       Project scripts and Node dependencies
package-lock.json                  Locked dependency versions
tsconfig.json                      TypeScript configuration
biome.json                         Biome lint/format configuration
.env.example                       Template for local Slack and OpenAI environment variables
scripts/verify-env.ts              Checks required environment variables before running locally
src/app.ts                         Bolt app startup, Socket Mode setup, Slack event routing, and Agent message handler
src/env.ts                         Small helpers for required and optional environment variables
src/listeners/assistant/index.ts   Legacy Bolt Assistant thread handlers
src/agent/llm-caller.ts            OpenAI Responses API streaming and tool-call loop
src/agent/tools/dice.ts            Example roll_dice tool used by the LLM
```

## Key files

### `manifest.json`

Defines the Slack app configuration:

- `agent_view` for Slack's current AI Agents experience
- Bot scopes such as `assistant:write`, `chat:write`, `im:history`, and channel history scopes
- Bot events such as `message.im`, `app_home_opened`, `app_mention`, and legacy assistant thread events
- Suggested prompts displayed in Slack
- Socket Mode enabled for local development

### `src/app.ts`

The main application entrypoint. It:

- Loads environment variables
- Creates the Bolt `App`
- Enables Socket Mode when `SLACK_APP_TOKEN` exists
- Logs incoming Slack payload shapes for debugging
- Registers legacy Assistant listeners
- Handles current Agent panel root prompts through `app.message(...)`
- Streams OpenAI output back to Slack with `sayStream()`
- Handles simple channel mentions

### `src/agent/llm-caller.ts`

The OpenAI integration. It:

- Creates an OpenAI client from `OPENAI_API_KEY`
- Sends the Slack user message and system prompt to the Responses API
- Streams `response.output_text.delta` events into Slack
- Detects OpenAI function calls
- Runs local tools such as `roll_dice`
- Sends tool results back into OpenAI so the model can finish the answer

### `src/listeners/assistant/index.ts`

Legacy support for Slack's older Bolt `Assistant` class. It handles:

- `assistant_thread_started`
- `assistant_thread_context_changed`
- Threaded assistant user messages

The newer Slack Agent panel path is handled in `src/app.ts`, but this file is
kept so older assistant-thread events continue to work.

### `src/agent/tools/dice.ts`

Example tool implementation. It defines the `roll_dice` schema exposed to
OpenAI and the local function that executes the dice roll.

## Customization points

- Change suggested prompts in `manifest.json`.
- Change the system prompt in `src/app.ts` and `src/listeners/assistant/index.ts`.
- Add business tools under `src/agent/tools/`.
- Extend `callLLM()` in `src/agent/llm-caller.ts` for retrieval, memory, APIs, or custom tool handling.
- Replace the sample `roll_dice` tool with tools that call your internal systems.

## Troubleshooting

- If the app does not appear in Slack AI Agents, confirm `agent_view` is present
  in `manifest.json`, update the Slack app manifest, and reinstall the app.
- If Slack messages do not trigger responses, confirm the app is running with
  `npm start` or `npm run dev` and that `SLACK_APP_TOKEN` is set.
- If events arrive but OpenAI responses fail, check `OPENAI_API_KEY`,
  `OPENAI_MODEL`, and the app logs.
- If scopes or event subscriptions change, reinstall the Slack app.

## References

- [Detailed blog post: Build a Slack AI Assistant Using NodeJS](https://www.josephkhan.site/blog/build-slack-ai-assistant-nodejs/)
- [Slack Apps](https://api.slack.com/apps)
- [Slack app manifests](https://docs.slack.dev/reference/app-manifest/)
- [Developing Slack agents](https://docs.slack.dev/ai/developing-agents/)
- [Bolt for JavaScript](https://tools.slack.dev/bolt-js/)
