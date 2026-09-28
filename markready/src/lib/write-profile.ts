import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Writes profile fields, recreating the row if it is missing.
 *
 * A plain update against a missing row reports success having changed nothing
 * — which is exactly how a profile cleared in the Table Editor during testing
 * left an account stuck on /welcome forever. So: update first, which keeps
 * everything an existing row already holds; only if nothing matched, insert a
 * fresh row. Returns an error message, or null on success.
 */
export async function writeProfile(
  service: SupabaseClient,
  user: User,
  fields: Record<string, unknown>
): Promise<string | null> {
  const { data: updated, error: updateError } = await service
    .from("profiles")
    .update(fields)
    .eq("id", user.id)
    .select("id");
  if (updateError) return updateError.message;
  if (updated && updated.length > 0) return null;

  if (!user.email) return "Account has no email address";
  const { error: insertError } = await service
    .from("profiles")
    .insert({ id: user.id, email: user.email, ...fields });
  return insertError ? insertError.message : null;
}
