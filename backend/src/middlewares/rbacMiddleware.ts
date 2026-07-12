import { Context } from "../deps.ts";

export const rbacMiddleware = (requiredRole: "Admin" | "User" | "Auditor") => {
  return async (ctx: Context, next: () => Promise<unknown>) => {
    const userRole = ctx.request.headers.get("X-Wing-Role");

    if (!userRole) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Unauthorized: Missing X-Wing-Role header" };
      return;
    }

    // Simple hierarchy: Admin > Auditor > User
    const roles = ["User", "Auditor", "Admin"];
    const userRoleIndex = roles.indexOf(userRole);
    const requiredRoleIndex = roles.indexOf(requiredRole);

    if (userRoleIndex < requiredRoleIndex) {
      console.warn(
        `[RBAC] Access Denied. User Role: ${userRole}, Required: ${requiredRole}`
      );
      ctx.response.status = 403;
      ctx.response.body = { error: "Forbidden: Insufficient permissions" };
      return;
    }

    await next();
  };
};
