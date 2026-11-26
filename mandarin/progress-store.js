/* IndexedDB persistence for local learning progress; legacy JSON remains compatible. */
(function (root) {
  "use strict";
  function create(indexedDB) {
    let opening = null,
      queue = Promise.resolve();
    function open() {
      if (!opening)
        opening = new Promise((resolve, reject) => {
          const req = indexedDB.open("myCello-learning", 1);
          req.onupgradeneeded = () => req.result.createObjectStore("snapshots");
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => {
            opening = null;
            reject(req.error);
          };
          req.onblocked = () => {
            opening = null;
            reject(Error("Learning storage is blocked by another tab."));
          };
        });
      return opening;
    }
    async function read() {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("snapshots", "readonly"),
          req = tx.objectStore("snapshots").get("current");
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }
    function write(database) {
      const snapshot = JSON.parse(JSON.stringify(database));
      const op = queue.then(async () => {
        const db = await open();
        return new Promise((resolve, reject) => {
          const tx = db.transaction("snapshots", "readwrite");
          tx.objectStore("snapshots").put(
            { database: snapshot, savedAt: Date.now() },
            "current",
          );
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
          tx.onabort = () =>
            reject(tx.error || Error("Learning progress was not stored."));
        });
      });
      queue = op.catch(() => {});
      return op;
    }
    return { read, write, flush: () => queue };
  }
  const api = { create };
  if (typeof module !== "undefined") module.exports = api;
  else root.ProgressStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
