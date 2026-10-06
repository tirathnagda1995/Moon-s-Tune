import { readdir, readFile } from "node:fs/promises";
const forbidden = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "LLM_API_KEY",
  "MODERATION_API_KEY",
  "CRON_SECRET",
  "moon-pattern-server-secret-canary",
];
async function inspect(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${item.name}`;
    if (item.isDirectory()) await inspect(path);
    else if (/\.(?:js|html|json)$/.test(path)) {
      const data = await readFile(path, "utf8");
      if (forbidden.some((value) => data.includes(value)))
        throw new Error(`Server secret reference in client artifact: ${path}`);
    }
  }
}
await inspect(".next/static");
console.log(
  "Client static bundles contain no server-key references or secret canary.",
);
