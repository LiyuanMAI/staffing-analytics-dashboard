import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { seedDatabase } from "../src/data/database";
import { queryDashboard, toCsv } from "../src/data/analytics";
import { generateDataset } from "../src/data/generate";
import { DEFAULT_FILTERS, validateFilters, type Dataset } from "../src/domain";

const fixture: Dataset = {
  requests: [
    {
      id: "R1",
      business_unit: "Engineering",
      agency: "Northstar Talent",
      role: "Software Engineer",
      cost_centre: "CC-100 · Product",
      request_date: "2026-01-01",
      requested_positions: 2,
    },
    {
      id: "R2",
      business_unit: "Operations",
      agency: "Atlas People",
      role: "Data Analyst",
      cost_centre: "CC-200 · Delivery",
      request_date: "2026-01-01",
      requested_positions: 100,
    },
    {
      id: "R3",
      business_unit: "Finance",
      agency: "In-house",
      role: "Account Manager",
      cost_centre: "CC-300 · Corporate",
      request_date: "2026-09-01",
      requested_positions: 3,
    },
    {
      id: "R4",
      business_unit: "Customer Success",
      agency: "Bridge Recruitment",
      role: "Operations Specialist",
      cost_centre: "CC-300 · Corporate",
      request_date: "2026-08-01",
      requested_positions: 1,
    },
  ],
  hires: [
    {
      id: "H1",
      request_id: "R1",
      candidate_id: "S1",
      hire_date: "2026-01-11",
      end_date: "2026-04-11",
    }, // Exactly 90 days; included.
    ...Array.from({ length: 90 }, (_, i) => ({
      id: `H${i + 2}`,
      request_id: "R2",
      candidate_id: `S${i + 2}`,
      hire_date: "2026-02-10",
      end_date: null,
    })),
    {
      id: "H92",
      request_id: "R4",
      candidate_id: "S92",
      hire_date: "2026-08-15",
      end_date: "2026-08-20",
    }, // Immature leaver; excluded from both turnover counts.
  ],
  costs: [
    {
      id: "C1",
      request_id: "R1",
      cost_date: "2026-01-01",
      category: "Sourcing",
      amount_cents: 10000,
    },
    {
      id: "C2",
      request_id: "R1",
      cost_date: "2026-01-11",
      category: "Placement",
      amount_cents: 20000,
    },
    {
      id: "C3",
      request_id: "R2",
      cost_date: "2026-01-01",
      category: "Sourcing",
      amount_cents: 50000,
    },
    {
      id: "C4",
      request_id: "R2",
      cost_date: "2026-02-10",
      category: "Placement",
      amount_cents: 150000,
    },
    {
      id: "C5",
      request_id: "R3",
      cost_date: "2026-09-01",
      category: "Sourcing",
      amount_cents: 10000,
    },
  ],
};
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await seedDatabase(db, fixture);
}, 30000);
afterAll(async () => {
  await db.close();
});

describe("SQL metrics against hand-calculated fixtures", () => {
  const january = { ...DEFAULT_FILTERS, end: "2026-01-31" };
  it("recomputes weighted fill rate, preserving unfilled positions", async () => {
    const { summary } = await queryDashboard(db, january);
    expect(summary.requested).toBe(102);
    expect(summary.filled).toBe(91);
    expect(summary.fill_rate).toBeCloseTo((100 * 91) / 102);
    expect(summary.fill_rate).not.toBe(70);
    expect(summary.open).toBe(11);
  });
  it("pre-aggregates costs and hires before joining, preventing fan-out", async () => {
    const { summary } = await queryDashboard(db, january);
    expect(summary.total_cost).toBe(2300);
    expect(summary.cost_per_hire).toBeCloseTo(2300 / 91);
    expect(summary.time_to_hire).toBeCloseTo((10 + 90 * 40) / 91);
  });
  it("selects request cohorts and includes later hires/costs through the snapshot", async () => {
    const { summary } = await queryDashboard(db, {
      ...DEFAULT_FILTERS,
      start: "2026-01-01",
      end: "2026-01-01",
    });
    expect(summary.filled).toBe(91);
    expect(summary.total_cost).toBe(2300);
  });
  it("counts the 90-day boundary and excludes immature hires including early leavers", async () => {
    const { summary } = await queryDashboard(db, DEFAULT_FILTERS);
    expect(summary.mature_hires).toBe(91);
    expect(summary.early_leavers).toBe(1);
    expect(summary.turnover_90d).toBeCloseTo(100 / 91);
  });
  it.each([
    ["business_unit", "Engineering"],
    ["agency", "Northstar Talent"],
    ["role", "Software Engineer"],
    ["cost_centre", "CC-100 · Product"],
  ])("applies %s to all views", async (key, value) => {
    const result = await queryDashboard(db, {
      ...DEFAULT_FILTERS,
      [key]: value,
    });
    expect(result.summary.requests).toBe(1);
    expect(result.summary.filled).toBe(1);
    expect(result.details.map((row) => row.id)).toEqual(["R1"]);
    expect(result.trend.reduce((n, row) => n + row.filled, 0)).toBe(1);
    expect(result.breakdown.reduce((n, row) => n + row.total_cost, 0)).toBe(
      300,
    );
  });
  it("intersects filters and returns null ratios for an empty population", async () => {
    const result = await queryDashboard(db, {
      ...DEFAULT_FILTERS,
      business_unit: "Engineering",
      agency: "Atlas People",
    });
    expect(result.summary.requests).toBe(0);
    expect(result.summary.fill_rate).toBeNull();
    expect(result.summary.cost_per_hire).toBeNull();
    expect(result.summary.time_to_hire).toBeNull();
    expect(result.summary.turnover_90d).toBeNull();
    expect(result.details).toEqual([]);
  });
  it("retains sourcing cost when no hires exist, without dividing by zero", async () => {
    const { summary } = await queryDashboard(db, {
      ...DEFAULT_FILTERS,
      business_unit: "Finance",
    });
    expect(summary.total_cost).toBe(100);
    expect(summary.fill_rate).toBe(0);
    expect(summary.cost_per_hire).toBeNull();
    expect(summary.time_to_hire).toBeNull();
  });
  it("keeps zero-volume months rather than joining across gaps", async () => {
    const { trend } = await queryDashboard(db, DEFAULT_FILTERS);
    expect(trend).toHaveLength(9);
    expect(trend.find((row) => row.segment === "2026-03")).toMatchObject({
      requested: 0,
      filled: 0,
      fill_rate: null,
    });
  });
  it("reconciles breakdowns and detail exports to KPI totals", async () => {
    for (const group of [
      "business_unit",
      "agency",
      "role",
      "cost_centre",
    ] as const) {
      const result = await queryDashboard(db, DEFAULT_FILTERS, group);
      expect(result.breakdown.reduce((n, row) => n + row.requested, 0)).toBe(
        result.summary.requested,
      );
      expect(result.details.reduce((n, row) => n + row.cost, 0)).toBe(
        result.summary.total_cost,
      );
      expect(toCsv(result.details).split("\r\n")).toHaveLength(5);
    }
  });
  it("rejects invalid dates, inverted windows and unrecognised filters", () => {
    expect(() =>
      validateFilters({ ...DEFAULT_FILTERS, start: "2026-02-30" }),
    ).toThrow();
    expect(() =>
      validateFilters({
        ...DEFAULT_FILTERS,
        start: "2026-09-15",
        end: "2026-01-01",
      }),
    ).toThrow();
    expect(() =>
      validateFilters({ ...DEFAULT_FILTERS, agency: "' OR 1=1 --" }),
    ).toThrow();
  });
});
it("generates a deterministic dataset and validates all generated records", async () => {
  expect(generateDataset()).toEqual(generateDataset());
  const generatedDb = new PGlite();
  try {
    await seedDatabase(generatedDb, generateDataset());
    const result = await queryDashboard(generatedDb, DEFAULT_FILTERS);
    expect(result.summary.requests).toBe(180);
    expect(result.summary.filled).toBeLessThanOrEqual(result.summary.requested);
  } finally {
    await generatedDb.close();
  }
}, 30000);
