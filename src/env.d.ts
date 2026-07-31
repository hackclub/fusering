/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly AIRTABLE_API_KEY?: string;
  readonly AIRTABLE_BASE_ID?: string;
  readonly AIRTABLE_TABLE_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
