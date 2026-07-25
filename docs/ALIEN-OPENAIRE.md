# Alien Intelligence / OpenAIRE provenance

## Installed MCP endpoints (Cursor)

Configured in `~/.cursor/mcp.json` and `Picsou/.cursor/mcp.json`:

| Server id | URL |
| --- | --- |
| `alien-openaire` | `https://openaire.mcp.alien.club/mcp` |
| `alien-biorxiv` | `https://biorxiv.mcp.alien.club/mcp` |
| `alien-medrxiv` | `https://medrxiv.mcp.alien.club/mcp` |

Auth: OAuth 2.1 (Protected Resource Metadata). After install, open
**Cursor Settings → MCP**, click **Connect** on each Alien server, and finish
the browser login. Scopes: `openid profile email offline_access`.

## Fallback when MCP is not authenticated

Nightmare fixtures can still harvest the public OpenAIRE Graph API
(`api.openaire.eu`) and keep frozen `cases.alien.json` notes so
`npm run evaluate:matrix` stays jury-runnable offline.

| Layer | Status |
| --- | --- |
| Alien MCP (OpenAIRE / bioRxiv / medRxiv) | Installed — needs OAuth Connect |
| OpenAIRE Graph public API | Offline harvest fallback |
| Frozen Alien packet notes | Always available for fixture demos |
