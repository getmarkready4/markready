# MarkReady error notes

## Supabase production connectivity preflight, 2026-09-16

**What didn't work:** db query --project-ref alone requires --linked. With --linked, CLI preflight reported no IPv6 support and recommended linking. Linking the correct project then returned LegacyProjectPausedError. The Supabase hostname also failed DNS resolution while the project was inactive.

**What worked:** projects list confirmed authenticated access and link identified the paused-project blocker. After the user resumed the project, linking, queries and the reviewed migration succeeded. Use `db query --file` for a long transaction; embedding the migration and history text in a Windows argument exceeded its command-length limit. A local transaction wrapper applied the migration and history entry together.

**Note for next time:** Check project status before debugging database passwords/networking. Use npx.cmd in user PowerShell when npx.ps1 is blocked; do not weaken execution policy. Never create a replacement project or replay migrations to work around a paused project.
