import type { Consent, Observation } from "./domain";
import { supabase } from "./supabase";
const DB = "moon-pattern-v1";
async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 3);
    req.onupgradeneeded = () => {
      for (const name of ["observations", "consents", "revisions"])
        if (!req.result.objectStoreNames.contains(name))
          req.result.createObjectStore(name, { keyPath: "id" });
      const observations = req.transaction!.objectStore("observations");
      if (!observations.indexNames.contains("localDate"))
        observations.createIndex("localDate", "localDate");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function transaction<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, mode);
    const req = action(tx.objectStore(store));
    tx.oncomplete = () => {
      database.close();
      resolve(req.result);
    };
    tx.onerror = () => {
      database.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      database.close();
      reject(tx.error);
    };
  });
}
export function guestId() {
  let id = localStorage.getItem("mp-person");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("mp-person", id);
  }
  return id;
}
export async function listObservations(cloud: boolean): Promise<Observation[]> {
  if (cloud) {
    const { data, error } = await supabase()!.rpc("list_observations");
    if (error) throw error;
    return (data ?? []) as Observation[];
  }
  return transaction("observations", "readonly", (s) => s.getAll());
}
export async function saveObservation(o: Observation, cloud: boolean) {
  if (cloud) {
    const { error } = await supabase()!.rpc("save_observation", { entry: o });
    if (error) throw error;
  } else {
    const database = await db();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(
        ["observations", "revisions"],
        "readwrite",
      );
      const check = tx.objectStore("observations").get(o.id);
      check.onsuccess = () => {
        const old = check.result as Observation | undefined;
        if (
          (old && o.revision !== old.revision + 1) ||
          (!old && o.revision !== 1)
        ) {
          tx.abort();
          return;
        }
        const sameDay = tx
          .objectStore("observations")
          .index("localDate")
          .get(o.localDate);
        sameDay.onsuccess = () => {
          if (sameDay.result && sameDay.result.id !== o.id) {
            tx.abort();
            return;
          }
          tx.objectStore("observations").put(o);
          const snapshot = { ...o, journal: undefined };
          tx.objectStore("revisions").put({
            id: o.id + ":" + o.revision,
            observationId: o.id,
            revision: o.revision,
            data: snapshot,
          });
        };
      };
      tx.oncomplete = () => {
        database.close();
        resolve();
      };
      tx.onabort = tx.onerror = () => {
        database.close();
        reject(new Error("Revision conflict or storage failure"));
      };
    });
  }
}
export async function deleteObservation(id: string, cloud: boolean) {
  if (cloud) {
    const { error } = await supabase()!
      .from("daily_observations")
      .delete()
      .eq("id", id);
    if (error) throw error;
  } else {
    const database = await db();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(
        ["observations", "revisions"],
        "readwrite",
      );
      tx.objectStore("observations").delete(id);
      const cursor = tx.objectStore("revisions").openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (row) {
          if (row.value.observationId === id) row.delete();
          row.continue();
        }
      };
      tx.oncomplete = () => {
        database.close();
        resolve();
      };
      tx.onerror = () => {
        database.close();
        reject(tx.error);
      };
    });
  }
}
export async function saveConsent(consent: Consent, cloud: boolean) {
  if (cloud) {
    const { error } = await supabase()!.rpc("record_consent", {
      record: consent,
    });
    if (error) throw error;
  } else await transaction("consents", "readwrite", (s) => s.put(consent));
}
export async function listConsents(cloud: boolean): Promise<Consent[]> {
  if (cloud) {
    return (await allRows(
      "consents",
      "id,purpose,granted,timestamp,version,region",
    )) as Consent[];
  }
  return transaction("consents", "readonly", (s) => s.getAll());
}
export async function clearHistory(cloud: boolean) {
  if (cloud) {
    const { error } = await supabase()!.rpc("delete_history");
    if (error) throw error;
  } else {
    const database = await db();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(
        ["observations", "revisions"],
        "readwrite",
      );
      tx.objectStore("observations").clear();
      tx.objectStore("revisions").clear();
      tx.oncomplete = () => {
        database.close();
        resolve();
      };
      tx.onerror = tx.onabort = () => {
        database.close();
        reject(tx.error);
      };
    });
  }
}
export async function eraseGuest() {
  await clearHistory(false);
  await transaction("consents", "readwrite", (s) => s.clear());
  for (const key of ["mp-person", "mp-onboarded", "mp-locale", "mp-units"])
    localStorage.removeItem(key);
}

export async function exportLedger(cloud: boolean) {
  if (cloud) {
    const tables = [
      "observation_revisions",
      "derived_signals",
      "user_corrections",
      "lunar_context",
      "environment_context",
      "pattern_results",
      "health_measurements",
    ];
    const result: Record<string, unknown> = {};
    for (const table of tables) {
      result[table] = await allRows(table);
    }
    return result;
  }
  return {
    observation_revisions: await transaction("revisions", "readonly", (s) =>
      s.getAll(),
    ),
  };
}

async function allRows(table: string, columns = "*"): Promise<unknown[]> {
  const rows: unknown[] = [];
  let start = 0;
  while (true) {
    let query = supabase()!
      .from(table)
      .select(columns)
      .range(start, start + 999);
    query =
      table === "observation_revisions"
        ? query.order("observation_id").order("revision")
        : query.order(
            ["lunar_context", "environment_context"].includes(table)
              ? "observation_id"
              : "id",
          );
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    start += data.length;
  }
  return rows;
}
