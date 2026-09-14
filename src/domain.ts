export const AS_OF = "2026-09-15";
export const START_DATE = "2026-01-01";
export const DIMENSIONS = {
  business_unit: ["Engineering", "Operations", "Customer Success", "Finance"],
  agency: [
    "Northstar Talent",
    "Bridge Recruitment",
    "Atlas People",
    "In-house",
  ],
  role: [
    "Software Engineer",
    "Data Analyst",
    "Operations Specialist",
    "Account Manager",
  ],
  cost_centre: ["CC-100 · Product", "CC-200 · Delivery", "CC-300 · Corporate"],
} as const;
export type Dimension = keyof typeof DIMENSIONS;
export interface Filters {
  business_unit: string;
  agency: string;
  role: string;
  cost_centre: string;
  start: string;
  end: string;
}
export const DEFAULT_FILTERS: Filters = {
  business_unit: "",
  agency: "",
  role: "",
  cost_centre: "",
  start: START_DATE,
  end: AS_OF,
};
export interface Request {
  id: string;
  business_unit: string;
  agency: string;
  role: string;
  cost_centre: string;
  request_date: string;
  requested_positions: number;
}
export interface Hire {
  id: string;
  request_id: string;
  candidate_id: string;
  hire_date: string;
  end_date: string | null;
}
export interface Cost {
  id: string;
  request_id: string;
  cost_date: string;
  category: string;
  amount_cents: number;
}
export interface Dataset {
  requests: Request[];
  hires: Hire[];
  costs: Cost[];
}
export interface MetricRow {
  requests: number;
  requested: number;
  filled: number;
  open: number;
  total_cost: number;
  fill_rate: number | null;
  time_to_hire: number | null;
  cost_per_hire: number | null;
  mature_hires: number;
  early_leavers: number;
  turnover_90d: number | null;
}
export interface Breakdown extends MetricRow {
  segment: string;
}
export interface Detail {
  id: string;
  business_unit: string;
  agency: string;
  role: string;
  cost_centre: string;
  request_date: string;
  requested_positions: number;
  filled: number;
  cost: number;
  status: string;
}
export interface DashboardData {
  summary: MetricRow;
  trend: Breakdown[];
  breakdown: Breakdown[];
  details: Detail[];
}
export function validateFilters(filters: Filters) {
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  for (const date of [filters.start, filters.end]) {
    if (
      !isoDate.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    ) {
      throw new Error("Choose valid start and end dates.");
    }
  }
  if (filters.start > filters.end)
    throw new Error("Start date must be on or before end date.");
  if (filters.start < START_DATE || filters.end > AS_OF)
    throw new Error(`Choose dates between ${START_DATE} and ${AS_OF}.`);
  for (const key of Object.keys(DIMENSIONS) as Dimension[]) {
    if (
      filters[key] &&
      !(DIMENSIONS[key] as readonly string[]).includes(filters[key])
    )
      throw new Error("Unknown filter value.");
  }
}
