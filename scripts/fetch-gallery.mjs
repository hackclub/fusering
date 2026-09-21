// Fetches the "Export data" table from Airtable, downloads every Screenshot
// attachment into public/gallery/, and writes a manifest at src/data/gallery.json
// that the site reads at build time (no network calls, no PAT needed to build).
//
// Run with: node scripts/fetch-gallery.mjs
// Re-run any time you want to resync with new Airtable submissions.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const BASE_ID = "appEzqwaKMw9F4E3K";
const TABLE_ID = "tblHnHGzuUyMbzRZl";
const IMAGE_DIR = "public/gallery";
const MANIFEST_PATH = "src/data/gallery.json";

function loadEnvToken() {
  const env = readFileSync(".env", "utf8");
  const match = env.match(/^AIRTABLE_PAT=(.+)$/m);
  if (!match) throw new Error("AIRTABLE_PAT not found in .env");
  return match[1].trim();
}

async function fetchAllRecords(pat) {
  let allRecords = [];
  let offset;
  let page = 0;

  do {
    page++;
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
    url.searchParams.set("fields[]", "Screenshot");
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${pat}` } });
    if (!res.ok) throw new Error(`Airtable API error: ${res.status} ${await res.text()}`);
    const data = await res.json();

    console.log(`  page ${page}: ${data.records.length} records`);
    allRecords = allRecords.concat(data.records);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

async function downloadAttachment(attachment) {
  const sourceUrl = attachment.thumbnails?.large?.url ?? attachment.url;
  const ext = attachment.type.split("/")[1] ?? "png";
  const filename = `${attachment.id}.${ext}`;
  const filePath = `${IMAGE_DIR}/${filename}`;

  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Failed to download ${attachment.id}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(filePath, buf);

  return {
    id: attachment.id,
    path: `/gallery/${filename}`,
    width: attachment.thumbnails?.large?.width ?? attachment.width,
    height: attachment.thumbnails?.large?.height ?? attachment.height,
  };
}

async function main() {
  const pat = loadEnvToken();

  console.log("Fetching records from Airtable...");
  const records = await fetchAllRecords(pat);
  console.log(`Fetched ${records.length} records total.`);

  const attachments = records.flatMap((r) => r.fields.Screenshot ?? []);
  console.log(`Found ${attachments.length} screenshot attachments to download.`);

  if (!existsSync(IMAGE_DIR)) mkdirSync(IMAGE_DIR, { recursive: true });

  const manifest = [];
  for (let i = 0; i < attachments.length; i++) {
    const entry = await downloadAttachment(attachments[i]);
    manifest.push(entry);
    process.stdout.write(`\r  downloaded ${i + 1}/${attachments.length}`);
  }
  console.log();

  mkdirSync("src/data", { recursive: true });
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`Wrote manifest with ${manifest.length} entries to ${MANIFEST_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
