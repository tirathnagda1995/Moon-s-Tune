import { createClient } from "@supabase/supabase-js";
import { authenticated, privateHeaders, sameOrigin } from "@/lib/server";
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: "Forbidden" },
      { status: 403, headers: privateHeaders },
    );
  const auth = await authenticated(request);
  if (!auth)
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: privateHeaders },
    );
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url)
    return Response.json(
      { error: "Deletion is not configured" },
      { status: 503, headers: privateHeaders },
    );
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.auth.admin.deleteUser(auth.user.id);
  return Response.json(
    error ? { error: "Deletion failed" } : { deleted: true },
    { status: error ? 502 : 200, headers: privateHeaders },
  );
}
