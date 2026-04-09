import { redirect } from "next/navigation";

import { getServerSession } from "@/src/lib/auth/session";
import { getDb } from "@/src/lib/mongodb/client";

type ServerContextOptions = {
  roles?: string[];
  redirectTo?: string;
};

export async function getServerContext(options: ServerContextOptions = {}) {
  const { roles = ["doctor"], redirectTo = "/login" } = options;
  const session = await getServerSession();
  if (!session) redirect(redirectTo);
  if (!roles.includes(String(session.role))) redirect(redirectTo);
  const db = await getDb();
  return { db, session };
}
