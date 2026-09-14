import sql from "../../sql/metrics.sql?raw";
import {
  AS_OF,
  validateFilters,
  type Filters,
  type Dimension,
  type DashboardData,
  type MetricRow,
  type Breakdown,
  type Detail,
} from "../domain";
import type { PGlite } from "@electric-sql/pglite";

const measures = `
  COUNT(id)::int AS requests,
  COALESCE(SUM(requested_positions),0)::int AS requested,
  COALESCE(SUM(filled),0)::int AS filled,
  COALESCE(SUM(requested_positions-filled),0)::int AS open,
  COALESCE(SUM(cost),0)::float8 AS total_cost,
  (100.0 * SUM(filled) / NULLIF(SUM(requested_positions),0))::float8 AS fill_rate,
  (SUM(total_days) / NULLIF(SUM(filled),0))::float8 AS time_to_hire,
  (SUM(cost) / NULLIF(SUM(filled),0))::float8 AS cost_per_hire,
  COALESCE(SUM(mature_hires),0)::int AS mature_hires,
  COALESCE(SUM(early_leavers),0)::int AS early_leavers,
  (100.0 * SUM(early_leavers) / NULLIF(SUM(mature_hires),0))::float8 AS turnover_90d`;
const segments: Record<Dimension, string> = {
  business_unit: "business_unit",
  agency: "agency",
  role: "role",
  cost_centre: "cost_centre",
};
export async function queryDashboard(
  db: PGlite,
  filters: Filters,
  groupBy: Dimension = "agency",
): Promise<DashboardData> {
  validateFilters(filters);
  if (!Object.hasOwn(segments, groupBy))
    throw new Error("Unknown breakdown dimension.");
  const params = [
    filters.start,
    filters.end,
    filters.business_unit,
    filters.agency,
    filters.role,
    filters.cost_centre,
    AS_OF,
  ];
  const summary = await db.query<MetricRow>(
    sql + `SELECT ${measures} FROM request_facts`,
    params,
  );
  const trend = await db.query<Breakdown>(
    sql +
      `,
    months AS (SELECT generate_series(date_trunc('month',$1::date),date_trunc('month',$2::date),'1 month')::date AS month)
    SELECT to_char(month,'YYYY-MM') AS segment, ${measures}
    FROM months LEFT JOIN request_facts ON date_trunc('month',request_date)=month
    GROUP BY month ORDER BY month`,
    params,
  );
  const breakdown = await db.query<Breakdown>(
    sql +
      `SELECT ${segments[groupBy]} AS segment, ${measures}
    FROM request_facts GROUP BY ${segments[groupBy]} ORDER BY fill_rate DESC NULLS LAST,segment`,
    params,
  );
  const details = await db.query<Detail>(
    sql +
      `SELECT id,business_unit,agency,role,cost_centre,
    to_char(request_date,'YYYY-MM-DD') AS request_date,requested_positions,filled,cost,
    CASE WHEN filled=requested_positions THEN 'Filled' WHEN filled=0 THEN 'Open' ELSE 'Partial' END AS status
    FROM request_facts ORDER BY request_date DESC,id`,
    params,
  );
  return {
    summary: summary.rows[0],
    trend: trend.rows,
    breakdown: breakdown.rows,
    details: details.rows,
  };
}
export function toCsv(rows: Detail[]) {
  const columns: (keyof Detail)[] = [
    "id",
    "request_date",
    "business_unit",
    "agency",
    "role",
    "cost_centre",
    "requested_positions",
    "filled",
    "cost",
    "status",
  ];
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((key) => cell(row[key])).join(",")),
  ].join("\r\n");
}
