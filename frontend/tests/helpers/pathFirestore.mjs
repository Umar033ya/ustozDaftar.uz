// In-memory Admin Firestore stand-in with nested collections, used by the
// route-level tests (support chat, inPAY webhook). Supports what those code
// paths call: doc get/set(merge)/update, sub-collections, where/orderBy/limit,
// count(), getAll(), batch() and serialised transactions. FieldValue.increment
// comes from tests/helpers/fakeFirestoreModule.mjs.

const isIncrement = (v) => v && typeof v === "object" && v.__op === "increment";

function applyWrite(prev, data) {
  const next = { ...(prev || {}) };
  for (const [k, v] of Object.entries(data)) {
    next[k] = isIncrement(v) ? (Number(next[k]) || 0) + v.n : v;
  }
  return next;
}

const isPlainMap = (v) => v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

/** set(..., { merge: true }) merges nested maps recursively, like Firestore. */
function mergeWrite(prev, data) {
  const next = { ...(prev || {}) };
  for (const [k, v] of Object.entries(data)) {
    if (isIncrement(v)) next[k] = (Number(next[k]) || 0) + v.n;
    else if (isPlainMap(v) && isPlainMap(next[k])) next[k] = mergeWrite(next[k], v);
    else next[k] = v;
  }
  return next;
}

const COMPARE = {
  "==": (a, b) => a === b,
  ">": (a, b) => a > b,
  ">=": (a, b) => a >= b,
  "<": (a, b) => a < b,
  "<=": (a, b) => a <= b,
};

export function pathDb() {
  const store = new Map(); // "a/b/c/d" -> data
  let autoId = 0;

  const snapshot = (path, data) => ({
    id: path.split("/").pop(),
    ref: docRef(path),
    exists: data !== undefined,
    data: () => (data === undefined ? undefined : structuredClone(data)),
    get: (field) => data?.[field],
  });

  function docRef(path) {
    return {
      id: path.split("/").pop(),
      path,
      collection: (name) => collectionRef(`${path}/${name}`),
      async get() {
        return snapshot(path, store.get(path));
      },
      async set(data, opts) {
        store.set(path, opts?.merge ? mergeWrite(store.get(path), data) : applyWrite(undefined, data));
      },
      async update(data) {
        if (!store.has(path)) throw Object.assign(new Error("NOT_FOUND"), { code: 5 });
        store.set(path, applyWrite(store.get(path), data));
      },
    };
  }

  function query(colPath, filters = [], order = null, max = Infinity) {
    const run = () => {
      const depth = colPath.split("/").length + 1;
      let docs = [...store.entries()]
        .filter(([k]) => k.startsWith(`${colPath}/`) && k.split("/").length === depth)
        .map(([k, v]) => snapshot(k, v))
        .filter((s) => filters.every(([f, op, val]) => COMPARE[op](s.get(f), val)));
      if (order) {
        const [f, dir] = order;
        docs.sort((a, b) => (a.get(f) > b.get(f) ? 1 : a.get(f) < b.get(f) ? -1 : 0) * (dir === "desc" ? -1 : 1));
      }
      return docs.slice(0, max);
    };
    return {
      where: (f, op, val) => query(colPath, [...filters, [f, op, val]], order, max),
      orderBy: (f, dir = "asc") => query(colPath, filters, [f, dir], max),
      limit: (n) => query(colPath, filters, order, n),
      select: () => query(colPath, filters, order, max),
      async get() {
        const docs = run();
        return { docs, empty: docs.length === 0, size: docs.length };
      },
      count: () => ({ get: async () => ({ data: () => ({ count: run().length }) }) }),
    };
  }

  function collectionRef(path) {
    return {
      ...query(path),
      path,
      doc: (id) => docRef(`${path}/${id ?? `auto${String(++autoId).padStart(16, "0")}`}`),
      async add(data) {
        const ref = docRef(`${path}/auto${String(++autoId).padStart(16, "0")}`);
        await ref.set(data);
        return ref;
      },
    };
  }

  const db = {
    store,
    collection: (name) => collectionRef(name),
    async getAll(...args) {
      const refs = args.filter((a) => a && typeof a.path === "string");
      return Promise.all(refs.map((r) => r.get()));
    },
    batch() {
      const ops = [];
      return {
        set: (ref, data, opts) => ops.push(() => ref.set(data, opts)),
        update: (ref, data) => ops.push(() => ref.update(data)),
        async commit() {
          for (const op of ops) await op();
        },
      };
    },
    queue: Promise.resolve(),
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
    /** Test helper: read a document's raw data by path. */
    raw: (path) => structuredClone(store.get(path)),
  };
  return db;
}
