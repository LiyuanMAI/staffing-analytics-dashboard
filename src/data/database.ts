import { PGlite } from "@electric-sql/pglite";
import schema from "../../sql/schema.sql?raw";
import { generateDataset } from "./generate";
import { AS_OF, type Dataset } from "../domain";

export async function seedDatabase(db: PGlite, data: Dataset) {
  await db.exec(schema);
  await db.transaction(async (tx) => {
    for (const r of data.requests)
      await tx.query(
        "INSERT INTO staffing_request VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [
          r.id,
          r.business_unit,
          r.agency,
          r.role,
          r.cost_centre,
          r.request_date,
          r.requested_positions,
        ],
      );
    for (const h of data.hires)
      await tx.query("INSERT INTO hire VALUES ($1,$2,$3,$4,$5)", [
        h.id,
        h.request_id,
        h.candidate_id,
        h.hire_date,
        h.end_date,
      ]);
    for (const c of data.costs)
      await tx.query("INSERT INTO hiring_cost VALUES ($1,$2,$3,$4,$5)", [
        c.id,
        c.request_id,
        c.cost_date,
        c.category,
        c.amount_cents,
      ]);
  });
  const issues = await db.query<{ issue: string }>(
    `
    SELECT 'Hire precedes request' AS issue FROM hire h JOIN staffing_request r ON r.id=h.request_id
      WHERE h.hire_date < r.request_date
    UNION ALL SELECT 'Overfilled request' FROM staffing_request r JOIN hire h ON h.request_id=r.id
      GROUP BY r.id,r.requested_positions HAVING count(*) > r.requested_positions
    UNION ALL SELECT 'Future request' FROM staffing_request WHERE request_date > $1::date
  `,
    [AS_OF],
  );
  if (issues.rows.length)
    throw new Error(`Dataset validation failed: ${issues.rows[0].issue}`);
}
let database: Promise<PGlite> | undefined;
export function getDatabase() {
  database ??= (async () => {
    const db = new PGlite();
    await seedDatabase(db, generateDataset());
    return db;
  })().catch((error) => {
    database = undefined;
    throw error;
  });
  return database;
}
