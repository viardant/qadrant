# @viardant/qadrant-cli

Command-line companion to [Qadrant](https://github.com/viardant/qadrant), the personal time tracker. Start and stop timers, list past sessions, and pull aggregate stats from a PocketBase-backed workspace.

## Install

```bash
npm install -g @viardant/qadrant-cli
```

The `qadrant` binary will be on your `PATH`.

## Get a token

1. Open the Qadrant web app and sign in with Google.
2. Navigate to **Settings → CLI_AND_AI_AGENT_ACCESS**.
3. Click **COPY** next to the auth token.
4. Paste it into your terminal:

```bash
qadrant login <paste-token>
```

On success you'll see `LOGIN_SUCCESSFUL_AUTHENTICATED`. The token is stored in `~/.qadrant/config.json` with `0600` permissions.

## Commands

```bash
qadrant login <token> [--url <pocketbase-url>]
qadrant logout
qadrant whoami [--format text|json]
qadrant start "<space>" [--sub <specialization>]
qadrant stop
qadrant status
qadrant list [--limit <n>] [--space <name>] [--spec <name>] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--offset <n>] [--format text|json]
qadrant stats [--by space|combo|day|week|month] [--period today|this-week|this-month|all] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--space <name>] [--spec <name>] [--include-entries] [--format text|json]
```

The legacy `aggregate` command is still available as a deprecated alias for `stats --by …`.

## Global flags

```bash
qadrant --no-refresh <command>   # skip transparent token refresh on 401/403
qadrant --url <url> <command>    # override the configured PocketBase URL for a single call
```

## Auth behavior

The CLI transparently refreshes the token on `401`/`403` by calling PocketBase's `auth-refresh` endpoint, persists the rotated token, and retries the original call once. You will only see "Session expired" if the user record is banned or deleted.

Use `--no-refresh` to disable that and surface raw auth errors.

## Config

| Path | Mode | Contents |
| --- | --- | --- |
| `~/.qadrant/config.json` | `0600` | `pb_url`, `auth_token`, `user_id` |

## License

MIT
