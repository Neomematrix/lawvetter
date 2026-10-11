import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(path.join(root, "data", "large-datasets-manifest.json"), "utf8"),
);

function gitBlobSha(buffer) {
  return createHash("sha1")
    .update(`blob ${buffer.length}\0`)
    .update(buffer)
    .digest("hex");
}

for (const dataset of manifest.datasets) {
  const compressedParts = await Promise.all(
    dataset.parts.map((name) =>
      readFile(path.join(root, "data", "large-data-parts", name)),
    ),
  );
  const restored = gunzipSync(Buffer.concat(compressedParts));
  const restoredSha = gitBlobSha(restored);

  if (restored.length !== dataset.bytes || restoredSha !== dataset.gitBlobSha) {
    throw new Error(`Integrity check failed for ${dataset.path}`);
  }

  const destination = path.join(root, ...dataset.path.split("/"));
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, restored);
  console.log(`Restored ${dataset.path}`);
}

console.log("All LawVetter datasets restored and verified.");
