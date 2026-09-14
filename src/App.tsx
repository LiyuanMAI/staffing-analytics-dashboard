import { useEffect, useRef, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Database,
  Github,
  Layers3,
  RotateCcw,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import {
  AS_OF,
  DEFAULT_FILTERS,
  DIMENSIONS,
  START_DATE,
  type DashboardData,
  type Dimension,
  type Filters,
} from "./domain";
import { getDatabase } from "./data/database";
import { queryDashboard, toCsv } from "./data/analytics";

const titles: Record<Dimension, string> = {
  business_unit: "Business unit",
  agency: "Agency",
  role: "Role",
  cost_centre: "Cost centre",
};
const number = (value: number | null, digits = 0) =>
  value === null
    ? "—"
    : value.toLocaleString("en-GB", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });
const euro = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(value);
const percent = (value: number | null) =>
  value === null ? "—" : `${number(value, 1)}%`;
const month = (value: string) =>
  new Date(value + "-01T00:00:00Z").toLocaleDateString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
const PAGE_SIZE = 8;

export default function App() {
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [groupBy, setGroupBy] = useState<Dimension>("agency");
  const [data, setData] = useState<DashboardData>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(0);
  const [exported, setExported] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError("");
    setPage(0);
    setExported(false);
    getDatabase()
      .then((db) => queryDashboard(db, filters, groupBy))
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setBusy(false);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load analytics.",
          );
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filters, groupBy, retry]);
  const change = (key: keyof Filters, value: string) =>
    setFilters((previous) => ({ ...previous, [key]: value }));
  const filtered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const download = () => {
    if (!data || busy || error) return;
    const blob = new Blob(["\uFEFF" + toCsv(data.details)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `synthetic-staffing-requests-${filters.start}-to-${filters.end}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
  };
  const summary = data?.summary;
  const pages = Math.max(1, Math.ceil((data?.details.length ?? 0) / PAGE_SIZE));
  const visibleDetails =
    data?.details.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) ?? [];
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#overview"
          aria-label="Staffing analytics home"
        >
          <span className="brand-mark">
            <Layers3 size={23} />
          </span>
          <span>
            Staffing<span className="brand-sub">ANALYTICS</span>
          </span>
        </a>
        <div className="nav-label">WORKSPACE</div>
        <a className="nav-item active" href="#overview">
          <BarChart3 size={18} /> Overview <span className="nav-dot" />
        </a>
        <a className="nav-item" href="#requests">
          <Users size={18} /> Requisitions
        </a>
        <button
          className="nav-item"
          onClick={() => dialog.current?.showModal()}
        >
          <BookOpen size={18} /> Metric definitions
        </button>
        <div className="sidebar-bottom">
          <div className="sample-indicator">
            <span /> Synthetic dataset
          </div>
          <p>
            Portfolio project
            <br />
            180 requisitions · 2026
          </p>
          <a
            className="source-link"
            href="https://github.com/LiyuanMAI/staffing-analytics-dashboard"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={16} /> View source <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>
      <main id="overview">
        <header className="topbar">
          <span>
            Workspace <ChevronRight size={14} />{" "}
            <strong>Staffing overview</strong>
          </span>
          <span className="snapshot">
            <span /> Snapshot · 15 Sep 2026
          </span>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <h1>Staffing overview</h1>
              <p>
                Track hiring delivery, speed and cost across your workforce.
              </p>
            </div>
            <button
              className="button export"
              disabled={!data || busy || !!error}
              onClick={download}
            >
              {exported ? <Check size={16} /> : <ArrowDownToLine size={16} />}
              {exported ? "CSV exported" : "Export CSV"}
            </button>
          </div>
          <section className="filters" aria-label="Dashboard filters">
            <div className="filter-heading">
              <SlidersHorizontal size={15} />
              <span>Filter requisitions</span>
              <button
                onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                disabled={!filtered}
              >
                <RotateCcw size={13} /> Reset
              </button>
            </div>
            <div className="filter-grid">
              {(Object.keys(DIMENSIONS) as Dimension[]).map((key) => (
                <label key={key}>
                  {titles[key]}
                  <select
                    value={filters[key]}
                    onChange={(event) => change(key, event.target.value)}
                  >
                    <option value="">
                      All{" "}
                      {key === "agency"
                        ? "agencies"
                        : key === "business_unit"
                          ? "business units"
                          : key === "role"
                            ? "roles"
                            : "cost centres"}
                    </option>
                    {DIMENSIONS[key].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
              ))}
              <label>
                Request date · from
                <input
                  aria-label="Request date from"
                  type="date"
                  min={START_DATE}
                  max={AS_OF}
                  value={filters.start}
                  onInput={(event) =>
                    change("start", event.currentTarget.value)
                  }
                />
              </label>
              <label>
                To
                <input
                  aria-label="Request date to"
                  type="date"
                  min={START_DATE}
                  max={AS_OF}
                  value={filters.end}
                  onInput={(event) => change("end", event.currentTarget.value)}
                />
              </label>
            </div>
          </section>
          <div className="scope-line">
            <span>
              <Database size={13} /> Simulated data · EUR · Outcomes through 15
              Sep 2026
            </span>
            <button onClick={() => dialog.current?.showModal()}>
              How metrics are calculated <CircleHelp size={13} />
            </button>
          </div>
          {error ? (
            <div className="error" role="alert">
              <h2>Could not load this view</h2>
              <p>{error}</p>
              <button
                className="button"
                onClick={() => setRetry((value) => value + 1)}
              >
                Retry
              </button>
              <button
                className="text-button"
                onClick={() => setFilters({ ...DEFAULT_FILTERS })}
              >
                Reset filters
              </button>
            </div>
          ) : !data ? (
            <div className="loading" role="status">
              <span className="spinner" />
              <h2>Preparing your workspace</h2>
              <p>Loading the local PostgreSQL engine and synthetic dataset…</p>
            </div>
          ) : (
            <div
              aria-busy={busy}
              className={busy ? "results pending" : "results"}
            >
              <span className="sr-only" role="status">
                {busy
                  ? "Updating dashboard"
                  : `${summary!.requests} requisitions, ${summary!.filled} filled positions`}
              </span>
              <section
                className="kpi-grid"
                aria-label="Key performance indicators"
              >
                <Metric
                  label="Fill rate"
                  value={percent(summary!.fill_rate)}
                  detail={`${number(summary!.filled)} filled / ${number(summary!.requested)} requested positions`}
                  formula="Filled positions ÷ requested positions. Recomputed from totals, not averaged across groups."
                  accent
                />
                <Metric
                  label="Time to hire"
                  value={
                    summary!.time_to_hire === null
                      ? "—"
                      : number(summary!.time_to_hire, 1)
                  }
                  unit={summary!.time_to_hire === null ? "" : "days"}
                  detail={`${number(summary!.filled)} successful hires · request to hire`}
                  formula="Mean calendar days from request date to hire date across successful hires. Open positions are excluded."
                />
                <Metric
                  label="Cost per hire"
                  value={euro(summary!.cost_per_hire)}
                  detail={`${euro(summary!.total_cost)} total hiring spend`}
                  formula="All sourcing and placement costs for selected requests ÷ their successful hires. Includes spend on unfilled requests."
                />
                <Metric
                  label="90-day turnover"
                  value={percent(summary!.turnover_90d)}
                  detail={`${summary!.early_leavers} early leavers / ${summary!.mature_hires} mature hires`}
                  formula="Leavers within 90 days ÷ hires with at least 90 days of follow-up. This is cohort turnover, not annual workforce turnover."
                />
              </section>
              {summary!.requests === 0 ? (
                <section className="empty">
                  <Users size={30} />
                  <h2>No requisitions in this view</h2>
                  <p>
                    Try a wider request-date range or clear a dimension filter.
                  </p>
                  <button
                    className="button"
                    onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                  >
                    Clear filters
                  </button>
                </section>
              ) : (
                <>
                  <section className="chart-grid">
                    <article className="panel trend-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Hiring delivery over time</h2>
                          <p>
                            By request month · latest cohorts are still maturing
                          </p>
                        </div>
                        <span className="pill">Monthly</span>
                      </div>
                      <div className="chart-legend">
                        <span>
                          <i className="legend-square pale" />
                          Requested
                        </span>
                        <span>
                          <i className="legend-line" />
                          Filled
                        </span>
                      </div>
                      <div className="chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            data={data.trend}
                            margin={{
                              left: -17,
                              right: 10,
                              top: 12,
                              bottom: 0,
                            }}
                            accessibilityLayer
                          >
                            <CartesianGrid vertical={false} stroke="#edf0ed" />
                            <XAxis
                              dataKey="segment"
                              tickFormatter={month}
                              axisLine={false}
                              tickLine={false}
                              tickMargin={12}
                              tick={{ fontSize: 12, fill: "#7a8580" }}
                            />
                            <YAxis
                              allowDecimals={false}
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 11, fill: "#7a8580" }}
                            />
                            <Tooltip
                              labelFormatter={(value) =>
                                `Request cohort · ${value}`
                              }
                              contentStyle={tooltipStyle}
                            />
                            <Area
                              isAnimationActive={false}
                              dataKey="requested"
                              name="Requested positions"
                              type="monotone"
                              fill="#e4eee7"
                              stroke="#c7dbce"
                              strokeWidth={1.5}
                            />
                            <Line
                              isAnimationActive={false}
                              dataKey="filled"
                              name="Filled positions"
                              type="monotone"
                              stroke="#2b6a52"
                              strokeWidth={2.5}
                              dot={{ r: 3, fill: "#fff", strokeWidth: 2 }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </article>
                    <article className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Fill rate by {titles[groupBy].toLowerCase()}</h2>
                          <p>Filled positions / requested positions</p>
                        </div>
                        <select
                          aria-label="Breakdown dimension"
                          className="compact-select"
                          value={groupBy}
                          onChange={(event) =>
                            setGroupBy(event.target.value as Dimension)
                          }
                        >
                          {(Object.keys(titles) as Dimension[]).map((key) => (
                            <option value={key} key={key}>
                              {titles[key]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="chart breakdown-chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={data.breakdown}
                            layout="vertical"
                            margin={{ left: 0, right: 24, top: 18, bottom: 0 }}
                            accessibilityLayer
                          >
                            <CartesianGrid
                              horizontal={false}
                              stroke="#edf0ed"
                            />
                            <XAxis
                              type="number"
                              domain={[0, 100]}
                              tickFormatter={(value) => `${value}%`}
                              ticks={[0, 25, 50, 75, 100]}
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 11, fill: "#7a8580" }}
                            />
                            <YAxis
                              dataKey="segment"
                              type="category"
                              width={128}
                              tick={{ fontSize: 11, fill: "#46534d" }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              contentStyle={tooltipStyle}
                              formatter={(value) => [
                                percent(Number(value)),
                                "Fill rate",
                              ]}
                            />
                            <Bar
                              isAnimationActive={false}
                              dataKey="fill_rate"
                              fill="#39755c"
                              radius={[0, 4, 4, 0]}
                              barSize={19}
                              onClick={(_entry, index) =>
                                change(groupBy, data.breakdown[index].segment)
                              }
                              cursor="pointer"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div
                        className="segment-actions"
                        aria-label="Filter by segment"
                      >
                        {data.breakdown.map((row) => (
                          <button
                            key={row.segment}
                            onClick={() => change(groupBy, row.segment)}
                            title={`Filter ${titles[groupBy]} to ${row.segment}`}
                          >
                            {row.segment}{" "}
                            <span>
                              {row.filled}/{row.requested}
                            </span>
                            <ArrowUpRight size={11} />
                          </button>
                        ))}
                      </div>
                    </article>
                  </section>
                  <section className="panel requests-panel" id="requests">
                    <div className="panel-heading">
                      <div>
                        <h2>
                          Requisitions{" "}
                          <span className="count">{summary!.requests}</span>
                        </h2>
                        <p>Inspect the records behind this view</p>
                      </div>
                      <span className="open-positions">
                        <span />
                        {summary!.open} unfilled positions
                      </span>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Requisition / role</th>
                            <th>Business unit</th>
                            <th>Agency</th>
                            <th>Cost centre</th>
                            <th>Requested</th>
                            <th>Filled</th>
                            <th>Spend</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleDetails.map((row) => (
                            <tr key={row.id}>
                              <td>
                                <strong>{row.role}</strong>
                                <small>
                                  {row.id} · {row.request_date}
                                </small>
                              </td>
                              <td>{row.business_unit}</td>
                              <td>{row.agency}</td>
                              <td>{row.cost_centre.split(" · ")[0]}</td>
                              <td className="numeric">
                                {row.requested_positions}
                              </td>
                              <td className="numeric">{row.filled}</td>
                              <td className="numeric">{euro(row.cost)}</td>
                              <td>
                                <span
                                  className={`status ${row.status.toLowerCase()}`}
                                >
                                  <i />
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="table-footer">
                      <span>
                        Showing {page * PAGE_SIZE + 1}–
                        {Math.min((page + 1) * PAGE_SIZE, data.details.length)}{" "}
                        of {data.details.length} requisitions
                      </span>
                      <div>
                        <button
                          aria-label="Previous page"
                          disabled={page === 0}
                          onClick={() => setPage((value) => value - 1)}
                        >
                          <ChevronLeft size={15} />
                        </button>
                        <span>
                          {page + 1} / {pages}
                        </span>
                        <button
                          aria-label="Next page"
                          disabled={page + 1 >= pages}
                          onClick={() => setPage((value) => value + 1)}
                        >
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </div>
                  </section>
                </>
              )}
              <footer>
                <span>
                  Fixed synthetic snapshot · Seed 9152026 · No real candidate
                  data
                </span>
                <span>React + TypeScript + PostgreSQL</span>
              </footer>
            </div>
          )}
        </div>
      </main>
      <dialog ref={dialog} className="definitions">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">MEASUREMENT NOTES</span>
            <h2>What the numbers mean</h2>
          </div>
          <button
            aria-label="Close metric definitions"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p>
          The date filters select requisitions by <strong>request date</strong>.
          Their hires and costs are observed through{" "}
          <strong>15 September 2026</strong>, including outcomes after the
          selected request window.
        </p>
        <dl>
          <dt>Fill rate</dt>
          <dd>
            Successful hires ÷ requested positions. A hire fills one position;
            later departures do not erase the original fill. Unfilled requests
            stay in the denominator.
          </dd>
          <dt>Time to hire</dt>
          <dd>
            Average calendar days from request to hire, across successful hires.
            In this demo it is a request-based measure; some organisations call
            this time to fill. Open positions are excluded, so immature cohorts
            may look faster.
          </dd>
          <dt>Cost per hire</dt>
          <dd>
            Total sourcing and placement spend associated with selected requests
            ÷ successful hires. Includes costs for requests that have not
            produced a hire. Currency is EUR throughout.
          </dd>
          <dt>90-day turnover</dt>
          <dd>
            Hires leaving within 90 days ÷ hires with a full 90 days of
            follow-up at the snapshot. Newer hires are excluded from both
            numerator and denominator. This is not an annual workforce turnover
            rate.
          </dd>
          <dt>Aggregation & empty results</dt>
          <dd>
            Hires and costs are aggregated to requisition grain before joining.
            Rates use summed numerators and denominators. Undefined ratios
            display “—”, never a misleading zero.
          </dd>
          <dt>Scope & limitations</dt>
          <dd>
            One requisition belongs to one agency, business unit, role and cost
            centre. No multi-agency allocation, cancellations or replacement
            hires are modelled. Dimension assignments are synthetic. This public
            demo has no authentication or production data-access controls.
          </dd>
        </dl>
        <a
          href="https://github.com/LiyuanMAI/staffing-analytics-dashboard"
          target="_blank"
          rel="noreferrer"
        >
          Inspect SQL, tests and data generation <ArrowUpRight size={14} />
        </a>
      </dialog>
    </div>
  );
}
const tooltipStyle = {
  border: "1px solid #e2e8e2",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 4px 20px #183d3610",
};
function Metric({
  label,
  value,
  unit,
  detail,
  formula,
  accent = false,
}: {
  label: string;
  value: string;
  unit?: string;
  detail: string;
  formula: string;
  accent?: boolean;
}) {
  return (
    <article className={`metric ${accent ? "metric-accent" : ""}`}>
      <div className="metric-label">
        {label}
        <button
          className="info-button"
          title={formula}
          aria-label={`${label}: ${formula}`}
        >
          <CircleHelp size={14} />
        </button>
      </div>
      <div className="metric-value">
        {value}
        {unit && <span>{unit}</span>}
      </div>
      <div className="metric-detail">{detail}</div>
    </article>
  );
}
