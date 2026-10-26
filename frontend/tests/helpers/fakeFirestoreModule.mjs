// Replaces "firebase-admin/firestore" in route-level tests (see routeHooks.mjs).
export const FieldValue = {
  increment: (n) => ({ __op: "increment", n }),
  serverTimestamp: () => Date.now(),
};
