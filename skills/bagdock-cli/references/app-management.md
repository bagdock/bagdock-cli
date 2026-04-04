# App Management Commands

Commands for managing the relationship between your local directory and a Bagdock app or edge.

## `bagdock link`

Links the current directory to a Bagdock app or edge. Once linked, other commands (deploy, env, open, inspect, submission) use the linked slug as a fallback — no `bagdock.json` required.

```bash
# Interactive: select from your apps
bagdock link

# Non-interactive (CI/agents)
bagdock link --slug my-adapter
```

Stores the link in `.bagdock/link.json`:

```json
{
  "slug": "my-adapter",
  "linkedAt": "2026-04-05T00:00:00.000Z"
}
```

### Slug Resolution Order

1. Explicit `--slug` or `--app` argument
2. `bagdock.json` in current directory
3. `.bagdock/link.json` (linked app)

## `bagdock open [slug]`

Opens the project in the Bagdock dashboard. Uses the slug resolution order above.

```bash
bagdock open
bagdock open my-adapter
```

In JSON mode, returns the URL instead of opening the browser:

```bash
bagdock open --json
# => {"url":"https://dashboard.bagdock.com/developer/apps/my-adapter","slug":"my-adapter"}
```

## `bagdock inspect [slug]`

Shows deployment details for an app.

```bash
bagdock inspect
bagdock inspect my-adapter --json
```

Displays:
- Name, slug, ID
- Type, category
- Version, maintainer, visibility
- Review status
- Worker URL, namespace
- Created, updated, published timestamps
