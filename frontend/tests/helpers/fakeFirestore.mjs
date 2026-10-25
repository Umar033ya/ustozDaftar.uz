// Minimal in-memory stand-in for the Admin Firestore calls used by the payment
// services (doc get/set/update, where+limit, select, serialised transactions).
export function fakeDb() {
  const store = new Map(); // "col/id" -> data
  let autoId = 0;
  const docRef = (col, id) => ({
    id,
    path: `${col}/${id}`,
    async get() {
      const data = store.get(`${col}/${id}`);
      return { exists: data !== undefined, id, data: () => (data ? structuredClone(data) : undefined) };
    },
    async set(data, opts) {
      const prev = store.get(`${col}/${id}`);
      store.set(`${col}/${id}`, opts?.merge ? { ...prev, ...data } : { ...data });
    },
    async update(data) {
      const prev = store.get(`${col}/${id}`);
      if (!prev) throw new Error("NOT_FOUND");
      store.set(`${col}/${id}`, { ...prev, ...data });
    },
  });
  const docsOf = (col) =>
    [...store.entries()].filter(([k]) => k.startsWith(`${col}/`)).map(([k, v]) => ({ id: k.split("/")[1], data: () => structuredClone(v) }));

  const db = {
    store,
    collection: (col) => ({
      doc: (id) => docRef(col, id ?? `auto${String(++autoId).padStart(12, "0")}`),
      async get() {
        return { docs: docsOf(col) };
      },
      async add(data) {
        const ref = docRef(col, `auto${String(++autoId).padStart(12, "0")}`);
        await ref.set(data);
        return ref;
      },
      where: (field, _op, value) => ({
        limit: () => ({
          async get() {
            const docs = docsOf(col).filter((d) => d.data()[field] === value);
            return { empty: docs.length === 0, docs };
          },
        }),
      }),
    }),
    queue: Promise.resolve(),
    // Serialised transactions model Firestore's guarantee that a transaction
    // re-runs on conflicting writes, which is what the idempotency relies on.
    runTransaction(fn) {
      const run = db.queue.then(() =>
        fn({
          get: (ref) => ref.get(),
          set: (ref, data, opts) => ref.set(data, opts),
          update: (ref, data) => ref.update(data),
        })
      );
      db.queue = run.catch(() => {});
      return run;
    },
  };
  return db;
}

export const silentLog = { info() {}, warn() {}, error() {} };
