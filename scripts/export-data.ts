import { mkdir, readFile, writeFile } from "node:fs/promises";
import { generateDataset } from "../src/data/generate";

const data = generateDataset();
await mkdir("data", { recursive: true });
const literal = (value: unknown) =>
  value === null
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : "'" + String(value).replaceAll("'", "''") + "'";
const definitions = [
  {
    name: "staffing_request",
    rows: data.requests,
    columns: [
      "id",
      "business_unit",
      "agency",
      "role",
      "cost_centre",
      "request_date",
      "requested_positions",
    ],
  },
  {
    name: "hire",
    rows: data.hires,
    columns: ["id", "request_id", "candidate_id", "hire_date", "end_date"],
  },
  {
    name: "hiring_cost",
    rows: data.costs,
    columns: ["id", "request_id", "cost_date", "category", "amount_cents"],
  },
];
let sql =
  "-- Deterministic synthetic data. Seed 9152026. No real personal data.\nBEGIN;\n";
for (const { name, rows, columns } of definitions) {
  const records = rows as unknown as Record<string, unknown>[];
  const csv = [
    columns.join(","),
    ...records.map((row) =>
      columns
        .map(
          (column) =>
            '"' + String(row[column] ?? "").replaceAll('"', '""') + '"',
        )
        .join(","),
    ),
  ].join("\n");
  await writeFile(`data/${name}.csv`, csv + "\n");
  for (const row of records)
    sql += `INSERT INTO ${name} (${columns.join(",")}) VALUES (${columns.map((column) => literal(row[column])).join(",")});\n`;
}
sql += "COMMIT;\n";
await writeFile("sql/seed.sql", sql);
await writeFile(
  "data/provenance.json",
  JSON.stringify(
    {
      classification: "synthetic",
      seed: 9152026,
      asOf: "2026-09-15",
      currency: "EUR",
      period: ["2026-01-01", "2026-09-15"],
      generator: "src/data/generate.ts",
      counts: {
        requests: data.requests.length,
        hires: data.hires.length,
        costs: data.costs.length,
      },
      limitations: [
        "Not actual staffing performance",
        "One agency per requisition",
        "No cancellations or replacement hires",
        "No production authentication",
      ],
    },
    null,
    2,
  ) + "\n",
);
const metrics = await readFile("sql/metrics.sql", "utf8");
await writeFile(
  "sql/example-query.sql",
  `-- Runnable in psql after schema.sql and seed.sql.\nPREPARE staffing_summary(date,date,text,text,text,text,date) AS\n${metrics}\nSELECT SUM(filled) AS filled, SUM(requested_positions) AS requested,\n  100.0*SUM(filled)/NULLIF(SUM(requested_positions),0) AS fill_rate,\n  SUM(total_days)/NULLIF(SUM(filled),0) AS time_to_hire_days,\n  SUM(cost)/NULLIF(SUM(filled),0) AS cost_per_hire_eur\nFROM request_facts;\nEXECUTE staffing_summary('2026-01-01','2026-09-15','','','','','2026-09-15');\nDEALLOCATE staffing_summary;\n`,
);
console.log(
  `Exported ${data.requests.length} requests, ${data.hires.length} hires and ${data.costs.length} costs.`,
);
