import { UserRole } from "./index";

// Defines pages accessible by each role
export const PAGE_ACCESS: Record<UserRole, string[]> = {
  owner: ["*"], // Wildcard meaning all pages
  admin: ["*"],
  manager: [
    "/dashboard",
    "/team",
    "/projects",
    "/tasks",
    "/clients",
    "/leads",
    "/responses",
    "/calls",
    "/meetings",
    "/audit",
    "/analytics",
    "/sheets",
    "/emails",
    "/web3-forms",
    "/insights",
    "/pipeline"
  ],
  member: [
    "/dashboard",
    "/team",
    "/projects",
    "/tasks",
    "/clients",
    "/leads",
    "/responses",
    "/sheets",
    "/calls",
    "/meetings",
    "/audit"
  ],
  viewer: [
    "/dashboard",
    "/team",
    "/projects",
    "/tasks",
    "/clients",
    "/leads",
    "/responses",
    "/sheets",
    "/calls",
    "/meetings",
    "/audit"
  ]
};

/**
 * Checks if a user role can access a specific page path.
 */
export function canAccessPage(role: UserRole | undefined, path: string): boolean {
  if (!role) return false;

  // Normalize path (strip trailing slashes, ignore query params)
  const cleanPath = path.split("?")[0];
  const normalizedPath = cleanPath === "/" ? "/" : cleanPath.replace(/\/$/, "");

  const allowedPrefixes = PAGE_ACCESS[role];
  console.log("canAccessPage check: role =", role, "path =", path, "normalizedPath =", normalizedPath, "allowedPrefixes =", allowedPrefixes);
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

  // Owner has full access to everything, always
  if (role === "owner") return true;

  // Viewer has only read access to allowed pages, never write/delete/create
  if (role === "viewer") {
    if (module === "web3forms" || module === "emails") {
      return false;
    }
    return action === "read";
  }

  // --- Users / Team Module ---
  if (module === "users") {
    if (role === "admin") {
      // Admins can view/read all users
      if (action === "read") return true;
      
      // Admins can create team members (but not owner)
      if (action === "create") {
        if (!item) return true;
        return item.role !== "owner";
      }
      
      // Admins cannot update or delete owners or other admins
      if (action === "update" || action === "delete") {
        if (!item) return true; // Generic check
        // Check if target user is owner or admin
        const targetIsOwnerOrAdmin = item.role === "owner" || item.role === "admin";
        if (targetIsOwnerOrAdmin) {
          // If updating own profile, admin is allowed to update their own details (but not change their own role)
          if (currentUserId && item.id === currentUserId) {
            return item.role === "admin"; // Can't change own role away from admin, or escalate it
          }
          return false;
        }
        // Admin can update/delete managers, members, viewers
        return true;
      }
    }
    
    if (role === "manager" || role === "member") {
      if (action === "read") return true;
      if (action === "update") {
        if (!item) return true;
        return item.id === currentUserId;
      }
      return false;
    }

    // viewer cannot write users
    return false;
  }

  // --- Audits Module ---
  if (module === "audits") {
    // Owner and admin have full access
    if (role === "admin") return true;

    // Manager and member can read, create, and update their own audits
    if (role === "manager" || role === "member") {
      if (action === "delete") return false; // Only admin/owner can delete audits
      if (action === "create") return true; // Can create audits
      if (action === "read" || action === "update") {
        if (!item) return true; // Generic check
        return item.createdBy === currentUserId;
      }
    }
    return false;
  }

  // --- Tasks Module ---
  if (module === "tasks") {
    if (role === "admin") return true;
    if (role === "manager") {
      return action !== "delete"; // Managers cannot delete tasks
    }
    if (role === "member") {
      if (action === "delete") return false; // Members cannot delete
      if (action === "create") return true; // Members can create tasks
      if (action === "read") return true;
      if (action === "update") {
        if (!item) return true;
        // Members can update tasks assigned to them or created by them
        return item.assignedTo === currentUserId || item.createdBy === currentUserId;
      }
    }
    return false;
  }

  // --- Calls & Meetings Module ---
  if (module === "calls" || module === "meetings") {
    if (role === "admin") return true;
    if (role === "manager") {
      return action !== "delete"; // Managers cannot delete
    }
    if (role === "member") {
      if (action === "delete") return false;
      if (action === "create") return true;
      if (action === "read") return true;
      if (action === "update") {
        if (!item) return true;
        // Members can update logs they recorded or created
        const creatorId = item.recordedBy || item.createdBy;
        return creatorId === currentUserId;
      }
    }
    return false;
  }

  // --- Sheets Module ---
  if (module === "sheets") {
    if (role === "admin") return true;
    if (role === "manager") {
      return action !== "delete";
    }
    if (role === "member") {
      if (action === "create" || action === "read") return true;
      if (action === "update" || action === "delete") {
        if (!item) return true;
        if (action === "delete") {
          return item.createdBy === currentUserId;
        }
        return item.assignedTo === currentUserId || item.createdBy === currentUserId;
      }
    }
    return false;
  }

  // --- Projects, Clients, Leads, Responses, Web3-Forms Module ---
  const standardModules = ["projects", "clients", "leads", "responses", "web3forms", "emails"];
  if (standardModules.includes(module)) {
    if (role === "admin") return true;
    if (role === "manager") {
      // Manager can read, create, and update standard modules, but NOT delete
      return action !== "delete";
    }
    if (role === "member") {
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
        if (action === "read" || action === "create" || action === "update") return true;
        return false;
      }
      if (module === "responses") {
        if (action === "read" || action === "create") return true;
        if (action === "update") {
          if (!item) return true;
          return item.assignedTo === currentUserId;
        }
        return false;
      }
      if (module === "web3forms" || module === "emails") {
        return false;
      }
      // Members can only read other standard modules, cannot create, update, or delete
      return action === "read";
    }
  }

  return false;
}
