# MIGRATION NOTES: 2-Tier Role Model Refactor & Security Lockdowns

This document outlines the transition of the "Stack & Scale" dashboard role model from 5 roles to 2 roles, along with API route lockouts and Firestore security rules.

---

## Action Required (Manual Actions)

> [!CAUTION]
> **ACTION REQUIRED (manual, cannot be automated):**
> On the phone linked to the WhatsApp integration, open WhatsApp → Linked Devices → log out **'admin-session'** immediately. This session was committed to a public repository and must be revoked immediately to stop the active credential leak. Re-link via QR code after redeploying.

> [!IMPORTANT]
> **CLEANUP STEPS (Run manually in workspace terminal):**
> 1. Stop tracking and remove the WhatsApp auth cache:
>    ```bash
>    git rm -r --cached .wwebjs_auth
>    # In Windows PowerShell:
>    Remove-Item -Recurse -Force .wwebjs_auth
>    # In Unix/Git Bash:
>    rm -rf .wwebjs_auth
>    ```
> 2. Delete the redundant configuration file (options are now merged into `next.config.ts`):
>    ```bash
>    # In Windows PowerShell:
>    Remove-Item -Force next.config.js
>    # In Unix/Git Bash:
>    rm next.config.js
>    ```

> [!IMPORTANT]
> **FIREBASE DEPLOYMENT:**
> You must run the following command to deploy rules to Firebase yourself (as we do not have production credentials):
> ```bash
> firebase deploy --only firestore:rules,storage
> ```

> [!IMPORTANT]
> **DATA MIGRATION:**
> Before allowing users to log in, run the bootstrap script to create the first admin user, and then run the role migration script to collapse existing user roles:
> 
> **1. Bootstrap the first admin:**
> ```bash
> node scripts/bootstrap-admin.mjs hello@stackandscale.in
> ```
> 
> **2. Dry-run role migration (safe):**
> ```bash
> node scripts/migrate-roles.mjs
> ```
> 
> **3. Apply role migration:**
> ```bash
> node scripts/migrate-roles.mjs --apply
> ```

---

## 1. Page Access & Action Matrix (2 Roles)

### Page Access Matrix (`PAGE_ACCESS`)

| Page Path / Prefix | `admin` | `member` | Notes |
| :--- | :---: | :---: | :--- |
| `*` (All Pages) | **Yes** | No | Wildcard access for admin |
| `/dashboard` | **Yes** | **Yes** | Core dashboard stats |
| `/team` | **Yes** | **Yes** | Team directory |
| `/projects` | **Yes** | **Yes** | Projects tracker |
| `/tasks` | **Yes** | **Yes** | Tasks boards |
| `/clients` | **Yes** | **Yes** | Client directory |
| `/leads` | **Yes** | **Yes** | CRM leads |
| `/responses` | **Yes** | **Yes** | Form submission responses |
| `/sheets` | **Yes** | **Yes** | Sheets & data import |
| `/calls` | **Yes** | **Yes** | Communications logs |
| `/meetings` | **Yes** | **Yes** | Meeting scheduler |
| `/audit` | **Yes** | **Yes** | Daily audit checker |
| `/emails` | **Yes** | No | Blocked for member |
| `/web3-forms` | **Yes** | No | Blocked for member |
| `/insights` | **Yes** | No | Blocked for member |
| `/analytics` | **Yes** | No | Blocked for member |
| `/pipeline` | **Yes** | No | Blocked for member |

---

### CRUD Action Permissions Matrix (`canPerformAction`)

| Module/Collection | Action | `admin` | `member` | Rule Details |
| :--- | :---: | :---: | :---: | :--- |
| **users** | Create | **Yes** | No | Members cannot add other members |
| | Read | **Yes** | **Yes** | Everyone can view the team |
| | Update | **Yes** | **Only Own** | Members can update their profile, but NOT their own role |
| | Delete | **Yes** | No | Members cannot remove users |
| **audits** | Create | **Yes** | **Yes** | Members can create audits |
| | Read | **Yes** | **Only Own** | Members can read their own audits |
| | Update | **Yes** | **Only Own** | Members can update their own audits |
| | Delete | **Yes** | No | Deletes restricted to admin |
| **tasks** | Create | **Yes** | **Yes** | |
| | Read | **Yes** | **Yes** | |
| | Update | **Yes** | **Own / Assigned** | Members can edit tasks they created or are assigned to |
| | Delete | **Yes** | No | |
| **calls** / **meetings** | Create | **Yes** | **Yes** | |
| | Read | **Yes** | **Yes** | |
| | Update | **Yes** | **Only Own** | Members can edit logs/meetings they recorded/created |
| | Delete | **Yes** | No | |
| **sheets** | Create | **Yes** | **Yes** | |
| | Read | **Yes** | **Yes** | |
| | Update | **Yes** | **Own / Assigned** | Members can edit sheets they created or are assigned to |
| | Delete | **Yes** | **Only Own** | Members can delete their own sheets |
| **projects** | Create | **Yes** | **Yes** | |
| | Read | **Yes** | **Yes** | |
| | Update | **Yes** | **Own / Assigned** | Members can update projects they created or are assigned to |
| | Delete | **Yes** | No | |
| **clients** | Create | **Yes** | **Yes** | |
| | Read | **Yes** | **Yes** | |
| | Update | **Yes** | **Only Own** | Members can update clients they registered |
| | Delete | **Yes** | No | |
| **leads** | Create | **Yes** | **Yes** | |
| | Read | **Yes** | **Yes** | |
| | Update | **Yes** | **Yes** | Members can read/create/update all leads (no deletes) |
| | Delete | **Yes** | No | |
| **responses** | Create | **Yes** | **Yes** | |
| | Read | **Yes** | **Yes** | |
| | Update | **Yes** | **Only Assigned** | Members can update responses assigned to them |
| | Delete | **Yes** | No | |
| **emails** / **web3forms** / **insights** | All | **Yes** | No | Blocked for member completely |

---

## 2. Every File to Touch

- **[.gitignore](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/.gitignore)** — Stop credential leaks (`.wwebjs_auth/`).
- **[app/lib/index.ts](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/lib/index.ts)** — Set `UserRole` to `admin | member`.
- **[app/lib/AuthContext.tsx](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/lib/AuthContext.tsx)** — Clean up role types, sign up owner-bypass, and flags (`isOwner`, `isManager`, `isViewer`).
- **[app/lib/permissions.ts](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/lib/permissions.ts)** — Update `PAGE_ACCESS`, delete log, rewrite `canPerformAction`.
- **[app/(dashboard)/team/page.tsx](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/(dashboard)/team/page.tsx)** — Offer only "Admin" and "Member" select, count admins block to guard demoting/deleting last admin.
- **[app/lib/useFirestore.ts](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/lib/useFirestore.ts)** — Remove `isManager` checks.
- **[app/(dashboard)/sheets/page.tsx](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/(dashboard)/sheets/page.tsx)** — Clean up `isManager` destructuring and usage.
- **[app/(dashboard)/tasks/page.tsx](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/(dashboard)/tasks/page.tsx)** — Clean up multi-role checks.
- **[app/(dashboard)/responses/page.tsx](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/(dashboard)/responses/page.tsx)** — Clean up role check bounds.
- **[app/(dashboard)/projects/page.tsx](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/(dashboard)/projects/page.tsx)** — Clean up multi-role check bounds.
- **[app/(dashboard)/meetings/page.tsx](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/(dashboard)/meetings/page.tsx)** — Clean up multi-role check bounds.
- **[app/(dashboard)/leads/page.tsx](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/(dashboard)/leads/page.tsx)** — Clean up multi-role checks.
- **[app/(dashboard)/clients/page.tsx](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/(dashboard)/clients/page.tsx)** — Clean up multi-role checks.
- **[app/(dashboard)/calls/page.tsx](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/(dashboard)/calls/page.tsx)** — Clean up multi-role checks.
- **[firestore.rules](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/firestore.rules)** (NEW) — Mirror permissions logic on Firestore database.
- **[storage.rules](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/storage.rules)** (NEW) — Secure attachments access by requiring authentication.
- **[firebase.json](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/firebase.json)** (NEW) — Register rule configurations.
- **[app/lib/firebaseAdmin.ts](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/lib/firebaseAdmin.ts)** (NEW) — Admin SDK initializer + `requireAdmin(req)`.
- **[app/api/inbox/route.js](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/api/inbox/route.js)** — Require token check on `GET`.
- **[app/api/inbox/[id]/route.js](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/api/inbox/[id]/route.js)** — Require token check on `GET` & `PATCH`, resolve params.
- **[app/api/inbox/reply/route.js](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/api/inbox/reply/route.js)** — Require token check on `POST`.
- **[app/api/send/route.js](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/api/send/route.js)** — Require token check on `POST`.
- **[app/api/search-console/route.js](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/api/search-console/route.js)** — Require token check on `GET`.
- **[app/(dashboard)/insights/page.tsx](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/(dashboard)/insights/page.tsx)** — Pass token header on search console API fetch.
- **[app/(dashboard)/emails/page.tsx](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/app/(dashboard)/emails/page.tsx)** — Pass token header on all email backend interactions.
- **[.env.example](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/.env.example)** (NEW) — Configuration key documentation.
- **[scripts/migrate-roles.mjs](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/scripts/migrate-roles.mjs)** (NEW) — Database migration tool.
- **[scripts/bootstrap-admin.mjs](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/scripts/bootstrap-admin.mjs)** (NEW) — Super-admin bootstrapping.
- **[next.config.ts](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/next.config.ts)** — Merged version config.
- **[next.config.js](file:///c:/Users/prati/OneDrive/Desktop/adminstackandscale/next.config.js)** (DELETE) — Deleted.

---

## 3. Firestore Rules Outline (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function role() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role; }
    function isAdmin() { return isSignedIn() && role() == 'admin'; }

    match /users/{uid} {
      allow read: if isSignedIn();
      allow create, delete: if isAdmin();
      allow update: if isAdmin() || (request.auth.uid == uid && request.resource.data.role == resource.data.role);
    }
    
    match /projects/{id} {
      allow read, create: if isSignedIn();
      allow update: if isAdmin() || (resource.data.createdBy == request.auth.uid || request.auth.uid in resource.data.assignees);
      allow delete: if isAdmin();
    }

    // Similar rules for tasks, clients, leads, responses, calls, meetings, sheets, audits
    // checking createdBy/assignedTo matching auth.uid...

    match /emails/{id} { allow read, write: if isAdmin(); }
    match /web3forms/{id} { allow read, write: if isAdmin(); }
    match /insights/{id} { allow read, write: if isAdmin(); }
  }
}
```
