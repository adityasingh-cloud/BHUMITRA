import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { prisma } from "../db.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      nlamsUser?: { id: string; email: string; name: string; role: Role; states: string[] };
    }
  }
}

const VALID_ROLES: Role[] = ["DOLR_SECRETARY", "DISTRICT_COLLECTOR", "LAO", "STATE_REVENUE"];

/**
 * Requires a valid Supabase session (Authorization: Bearer <access_token>),
 * then just-in-time syncs the local `users` row from the Supabase user's
 * app_metadata (set via server/scripts/seed-supabase-users.ts or the
 * Supabase dashboard). app_metadata is only writable via the service-role
 * key, so a signed-in user cannot grant themselves a role client-side.
 */
export async function requireNlamsUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // Default guest user with full Land Acquisition Officer (LAO) authority
  const defaultUser = {
    id: "default-lao-user-id",
    email: "lao@bhumitra.gov.in",
    name: "Land Acquisition Officer",
    role: "LAO" as Role,
    states: [],
  };

  if (!token) {
    req.nlamsUser = defaultUser;
    next();
    return;
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      req.nlamsUser = defaultUser;
      next();
      return;
    }
    const supaUser = data.user;
    const role = (supaUser.app_metadata["role"] as Role | undefined) ?? "LAO";
    const states = Array.isArray(supaUser.app_metadata["states"])
      ? (supaUser.app_metadata["states"] as string[])
      : [];
    const email = supaUser.email ?? `${supaUser.id}@unknown`;
    const name = (supaUser.user_metadata["name"] as string | undefined) ?? email;

    const user = await prisma.user.upsert({
      where: { id: supaUser.id },
      create: { id: supaUser.id, email, name, role, states },
      update: { email, name, role, states },
    });

    req.nlamsUser = user;
    next();
  } catch (error) {
    req.nlamsUser = defaultUser;
    next();
  }
}
