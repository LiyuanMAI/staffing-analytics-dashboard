-- PostgreSQL 16+ / PGlite. Currency: EUR, stored in integer cents.
-- Request grain: one requisition assigned to exactly one agency and dimension tuple.
CREATE TABLE staffing_request (
  id text PRIMARY KEY,
  business_unit text NOT NULL,
  agency text NOT NULL,
  role text NOT NULL,
  cost_centre text NOT NULL,
  request_date date NOT NULL,
  requested_positions integer NOT NULL CHECK (requested_positions > 0)
);
CREATE TABLE hire (
  id text PRIMARY KEY,
  request_id text NOT NULL REFERENCES staffing_request(id),
  candidate_id text NOT NULL UNIQUE,
  hire_date date NOT NULL,
  end_date date,
  CHECK (end_date IS NULL OR end_date >= hire_date)
);
CREATE TABLE hiring_cost (
  id text PRIMARY KEY,
  request_id text NOT NULL REFERENCES staffing_request(id),
  cost_date date NOT NULL,
  category text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0)
);
CREATE INDEX request_scope_idx ON staffing_request(request_date, business_unit);
CREATE INDEX hire_request_idx ON hire(request_id, hire_date);
CREATE INDEX cost_request_idx ON hiring_cost(request_id, cost_date);
