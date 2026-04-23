"use client";

import type { ReactNode } from "react";
import { useCan } from "~/hooks/use-can";
import type { PermissionAction } from "~/lib/auth/permissions";

// Renders `children` when the current user's role permits `action`;
// otherwise renders `fallback` (or nothing). Used to hide edit
// affordances that the backend would reject — observers shouldn't
// see an edit button they can't use.
//
// This is the UX layer. The server-side RLS is the authoritative
// guard; this component is a courtesy.

export function RoleGate({
  action,
  children,
  fallback = null,
}: {
  action: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const ok = useCan(action);
  if (!ok) return <>{fallback}</>;
  return <>{children}</>;
}
