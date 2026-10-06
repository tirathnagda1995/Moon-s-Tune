import type { Cipher } from "@/lib/domain";
import type { Feeling } from "./domain";
export interface PrivateMoment {
  id: string;
  scope: string;
  cityId: string;
  feeling: Feeling | null;
  promptId: number;
  createdAt: string;
  cipher: Cipher | null;
  schemaVersion: 1;
}
const name = "moon-private-moments-v2";
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("moments", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function query<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction("moments", mode),
      request = action(tx.objectStore("moments"));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export function savePrivateMoment(moment: PrivateMoment) {
  return query("readwrite", (store) => store.put(moment));
}
export async function listPrivateMoments(scope: string) {
  const rows = await query<PrivateMoment[]>("readonly", (store) =>
    store.getAll(),
  );
  return rows
    .filter((row) => row.scope === scope)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function deletePrivateMoment(id: string, scope: string) {
  const row = await query<PrivateMoment | undefined>("readonly", (store) =>
    store.get(id),
  );
  if (row?.scope !== scope) throw new Error("Not permitted");
  await query("readwrite", (store) => store.delete(id));
}
export async function erasePrivateMoments(scope: string) {
  const rows = await listPrivateMoments(scope);
  for (const row of rows) await deletePrivateMoment(row.id, scope);
}
