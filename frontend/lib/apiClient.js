"use client";

import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { useAuth } from "./authContext";

/** fetch() to our own API with the current user's Firebase ID token. */
export async function authorizedFetch(url, init = {}) {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error("Tizimga qayta kiring."), { code: "unauthorized", status: 401 });
  const token = await user.getIdToken();
  const response = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(payload?.error || ""), { code: payload?.code || "http_error", status: response.status });
  }
  return payload;
}

/**
 * Whether the signed-in user carries the server-assigned admin claim.
 * The token is force-refreshed once so a newly granted (or revoked) claim
 * applies without signing out. This only decides what to SHOW: every admin
 * API and Firestore rule checks the claim again on the server.
 *
 * @returns {{ isAdmin: boolean, checking: boolean }}
 */
// One forced token refresh per signed-in user and page load, shared by every
// component (the layout asks on each navigation).
const adminChecks = new Map();

function checkAdmin(user) {
  if (!adminChecks.has(user.uid)) {
    adminChecks.set(
      user.uid,
      user
        .getIdTokenResult(true)
        .then((result) => result.claims.admin === true)
        .catch(() => {
          adminChecks.delete(user.uid);
          return false;
        })
    );
  }
  return adminChecks.get(user.uid);
}

export function useIsAdmin() {
  const { currentUser } = useAuth();
  const [state, setState] = useState({ uid: null, isAdmin: false });

  useEffect(() => {
    if (!currentUser) return undefined;
    let cancelled = false;
    checkAdmin(currentUser).then((isAdmin) => !cancelled && setState({ uid: currentUser.uid, isAdmin }));
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  if (!currentUser) return { isAdmin: false, checking: false };
  return { isAdmin: state.uid === currentUser.uid && state.isAdmin, checking: state.uid !== currentUser.uid };
}
