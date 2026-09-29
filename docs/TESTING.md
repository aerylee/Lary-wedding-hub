# Testing the permissions

Untested row-level security is decoration. A missing policy isn't an error; it's an empty table, and the app looks like it works.

## Automated (every push)

`supabase test db` (or `npm run db:verify` without Docker) runs `supabase/tests/`. It covers the auth spec's §11 checks:

1. A collaborator reads **zero** budget, payment, vendor-finance and ceiling rows, and their activity feed carries no finance entries.
2. A viewer's insert/update/delete on every table is refused.
3. A member of wedding B reads, updates and deletes nothing in wedding A, looped over every table. Rows can't be moved between weddings either.
4. A planner can't add members, change roles or invite.
5. The last owner can't demote or remove themselves. Deleting the whole wedding still cascades.
6. An expired invitation creates no membership. A valid one is claimed on sign-up, with the email matched case-insensitively.
7. Attachments are tenant-scoped: outsiders can't list, sign or upload into another wedding's folder, and malformed paths fail closed.
8. A removed member's live session reads nothing on its very next query.
9. Every public table has RLS enabled and a full set of policies, every tenant table is registered in `app.table_perms`, and every `SECURITY DEFINER` function pins its `search_path`.

The unit suite (`npm test`) covers the budget/headcount/validity maths, CSV, address parsing, `.eml` decoding, vendor matching, and the server-side evidence check that backs "never guess".

## Manual, once per environment

- **Realtime respects RLS.** Open the app as the collaborator in one browser and as the owner in another. Change a budget line as the owner. The collaborator's network tab (WebSocket frames) must show no `budget_lines` event. A task change must arrive in both.
- **Removal is immediate.** Remove a member while they're signed in. Their next action is refused, and a reload shows "You no longer have access to this wedding".
- **Signed URLs.** Copy an attachment's signed URL, wait 60 seconds, and open it. It must have expired.
- **Service key.** `grep -r service_role dist/` finds nothing.
