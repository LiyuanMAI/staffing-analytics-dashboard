import { AS_OF, DIMENSIONS, type Dataset } from "../domain";

// Fixed PRNG: same seed always produces the same inspectable portfolio dataset.
export function generateDataset(seed = 9152026): Dataset {
  let state = seed >>> 0;
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const integer = (min: number, max: number) =>
    min + Math.floor(random() * (max - min + 1));
  const pick = <T>(values: readonly T[]) =>
    values[integer(0, values.length - 1)];
  const addDays = (date: string, days: number) =>
    new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
  const data: Dataset = { requests: [], hires: [], costs: [] };
  for (let i = 0; i < 180; i++) {
    const request_date = addDays("2026-01-01", integer(0, 257));
    const agency = pick(DIMENSIONS.agency);
    const role = pick(DIMENSIONS.role);
    const request = {
      id: `REQ-${String(i + 1).padStart(4, "0")}`,
      business_unit: pick(DIMENSIONS.business_unit),
      agency,
      role,
      cost_centre: pick(DIMENSIONS.cost_centre),
      request_date,
      requested_positions: integer(1, 6),
    };
    data.requests.push(request);
    data.costs.push({
      id: `COST-${data.costs.length + 1}`,
      request_id: request.id,
      cost_date: request_date,
      category: "Sourcing",
      amount_cents: integer(150, 950) * 100,
    });
    for (let j = 0; j < request.requested_positions; j++) {
      const chance =
        agency === "Northstar Talent"
          ? 0.9
          : agency === "Atlas People"
            ? 0.69
            : 0.81;
      const hire_date = addDays(
        request_date,
        integer(5, role === "Software Engineer" ? 55 : 38),
      );
      if (random() > chance || hire_date > AS_OF) continue;
      const plannedEnd =
        random() < 0.19 ? addDays(hire_date, integer(12, 170)) : null;
      const hire = {
        id: `HIRE-${data.hires.length + 1}`,
        request_id: request.id,
        candidate_id: `SYN-${String(data.hires.length + 1).padStart(5, "0")}`,
        hire_date,
        end_date: plannedEnd && plannedEnd <= AS_OF ? plannedEnd : null,
      };
      data.hires.push(hire);
      data.costs.push({
        id: `COST-${data.costs.length + 1}`,
        request_id: request.id,
        cost_date: hire_date,
        category: "Placement",
        amount_cents: integer(650, agency === "In-house" ? 1400 : 3900) * 100,
      });
    }
  }
  return data;
}
