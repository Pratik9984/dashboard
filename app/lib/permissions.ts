import { UserRole } from "./index";

// Defines pages accessible by each role
export const PAGE_ACCESS: Record<UserRole, string[]> = {
  admin: ["*"],
  member: [
    "/dashboard",
    "/team",
    "/projects",
    "/tasks",
    "/clients",
    "/leads",
    "/responses",
    "/sheets",
    "/meetings",
    "/audit",
    "/resources"
  ]
};

/**
 * Checks if a user role can access a specific page path.
 */
export function canAccessPage(role: UserRole | undefined, path: string): boolean {
  if (!role) return false;

  const normalizedRole = String(role).toLowerCase().trim();
  const targetRole: UserRole = (normalizedRole === "owner" || normalizedRole === "manager" || normalizedRole === "admin")
    ? "admin"
    : "member";

  // Normalize path (strip trailing slashes, ignore query params)
  const cleanPath = path.split("?")[0];
  const normalizedPath = cleanPath === "/" ? "/" : cleanPath.replace(/\/$/, "");

  const allowedPrefixes = PAGE_ACCESS[targetRole];
  if (!allowedPrefixes) return false;
  if (allowedPrefixes.includes("*")) {
    return true;
  }

  return allowedPrefixes.some(prefix => {
    if (prefix === "/") return normalizedPath === "/";
    return normalizedPath === prefix || normalizedPath.startsWith(prefix + "/");
  });
}

/**
 * Checks if a user role is permitted to perform a CRUD action on a specific module.
 * @param role The role of the current user.
 * @param module The module/collection name (e.g. 'users', 'projects', 'tasks', 'clients', 'leads', 'responses', 'calls', 'meetings', 'audits').
 * @param action The operation to perform ('create' | 'read' | 'update' | 'delete').
 * @param item The resource item being acted upon (optional, used for item-level ownership checks).
 * @param currentUserId The UID of the current user (optional, used for ownership checks).
 */
export function canPerformAction(
  role: UserRole | undefined,
  module: string,
  action: "create" | "read" | "update" | "delete",
  item?: any,
  currentUserId?: string
): boolean {
  if (!role) return false;

  const normalizedRole = String(role).toLowerCase().trim();
  const targetRole: UserRole = (normalizedRole === "owner" || normalizedRole === "manager" || normalizedRole === "admin")
    ? "admin"
    : "member";

  // Admin has full access to everything, always
  if (targetRole === "admin") return true;

  // Member permissions
  if (targetRole === "member") {
    // --- Users / Team Module ---
    if (module === "users") {
      if (action === "read") return true;
      if (action === "update") {
        if (!item) return true;
        return item.id === currentUserId;
      }
      return false;
    }

    // --- Audits Module ---
    if (module === "audits") {
      if (action === "delete") return false;
      if (action === "create") return true;
      if (action === "read" || action === "update") {
        if (!item) return true;
        return item.createdBy === currentUserId;
      }
      return false;
    }

    // --- Tasks Module ---
    if (module === "tasks") {
      if (action === "delete") return false;
      if (action === "create" || action === "read") return true;
      if (action === "update") {
        if (!item) return true;
        return item.assignedTo === currentUserId || item.createdBy === currentUserId;
      }
      return false;
    }

    // --- Meetings Module ---
    if (module === "meetings") {
      if (action === "delete") return false;
      if (action === "create" || action === "read") return true;
      if (action === "update") {
        if (!item) return true;
        const creatorId = item.recordedBy || item.createdBy;
        return creatorId === currentUserId;
      }
      return false;
    }

    // --- Sheets Module ---
    if (module === "sheets") {
      if (action === "create" || action === "read") return true;
      if (action === "update" || action === "delete") {
        if (!item) return true;
        if (action === "delete") {
          return item.createdBy === currentUserId;
        }
        return item.assignedTo === currentUserId || item.createdBy === currentUserId;
      }
      return false;
    }

    // --- Projects, Clients, Leads, Responses, Web3-Forms, Emails Module ---
    if (module === "projects") {
      if (action === "read" || action === "create") return true;
      if (action === "update") {
        if (!item) return true;
        return item.assignees?.includes(currentUserId) || item.createdBy === currentUserId;
      }
      return false;
    }
    if (module === "clients") {
      if (action === "read" || action === "create") return true;
      if (action === "update") {
        if (!item) return true;
        return item.createdBy === currentUserId;
      }
      return false;
    }
    if (module === "leads") {
      return action === "read" || action === "create" || action === "update";
    }
    if (module === "responses") {
      if (action === "read" || action === "create") return true;
      if (action === "update") {
        if (!item) return true;
        return item.assignedTo === currentUserId;
      }
      return false;
    }
    if (module === "resources") {
      return action === "read";
    }
    if (module === "web3forms" || module === "emails") {
      return false;
    }

    // fallback for member on other modules: read-only
    return action === "read";
  }

  return false;
}

