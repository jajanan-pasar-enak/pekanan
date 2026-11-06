import { Client } from "pg";
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
  await c.connect();
  const t = await c.query("select table_name from information_schema.tables where table_schema='public' order by 1");
  console.log("tables:", t.rows.map((r) => r.table_name).join(", "));
  const s = await c.query("insert into todos (text) values ('beli beras'), ('bayar listrik') returning text");
  console.log("seeded:", s.rows.map((r) => r.text).join(" | "));
  await c.end();
}
main();
