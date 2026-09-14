-- Parameters: $1 start, $2 end, $3 business unit, $4 agency, $5 role,
-- $6 cost centre, $7 as-of date. Empty strings remove dimension restrictions.
-- Window selects REQUEST cohorts. Outcomes/costs are observed through $7,
-- not just the cohort's request window. Costs and hires aggregate separately.
WITH scoped_requests AS (
  SELECT * FROM staffing_request
  WHERE request_date BETWEEN $1::date AND $2::date
    AND ($3::text = '' OR business_unit = $3)
    AND ($4::text = '' OR agency = $4)
    AND ($5::text = '' OR role = $5)
    AND ($6::text = '' OR cost_centre = $6)
), hire_totals AS (
  SELECT h.request_id, COUNT(*)::int AS filled,
    SUM(h.hire_date - r.request_date)::float8 AS total_days,
    COUNT(*) FILTER (WHERE h.hire_date <= $7::date - 90)::int AS mature_hires,
    COUNT(*) FILTER (WHERE h.hire_date <= $7::date - 90
      AND h.end_date <= h.hire_date + 90 AND h.end_date <= $7::date)::int AS early_leavers
  FROM hire h JOIN scoped_requests r ON r.id = h.request_id
  WHERE h.hire_date <= $7::date
  GROUP BY h.request_id
), cost_totals AS (
  SELECT c.request_id, SUM(c.amount_cents)::float8 / 100 AS cost
  FROM hiring_cost c JOIN scoped_requests r ON r.id = c.request_id
  WHERE c.cost_date <= $7::date
  GROUP BY c.request_id
), request_facts AS (
  SELECT r.*, COALESCE(h.filled, 0) AS filled,
    COALESCE(h.total_days, 0) AS total_days,
    COALESCE(h.mature_hires, 0) AS mature_hires,
    COALESCE(h.early_leavers, 0) AS early_leavers,
    COALESCE(c.cost, 0) AS cost
  FROM scoped_requests r
  LEFT JOIN hire_totals h ON h.request_id = r.id
  LEFT JOIN cost_totals c ON c.request_id = r.id
)
-- The TypeScript query composer appends a whitelisted projection here.
