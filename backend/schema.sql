CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id SERIAL PRIMARY KEY,
  model_name VARCHAR(100) NOT NULL,
  vehicle_type VARCHAR(50) NOT NULL,
  fuel_type VARCHAR(50) NOT NULL,
  efficiency_rating NUMERIC(8,2) NOT NULL CHECK (efficiency_rating > 0)
);

CREATE TABLE IF NOT EXISTS emissions_factors (
  factor_id SERIAL PRIMARY KEY,
  fuel_type VARCHAR(50) UNIQUE NOT NULL,
  co2_per_km_per_kg NUMERIC(12,8) NOT NULL CHECK (co2_per_km_per_kg > 0)
);

CREATE TABLE IF NOT EXISTS drivers (
  driver_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  license_number VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(30) NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE', 'ON_LEAVE'))
);

CREATE TABLE IF NOT EXISTS shipments (
  shipment_id SERIAL PRIMARY KEY,
  vehicle_id INT NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE RESTRICT,
  origin VARCHAR(100) NOT NULL,
  destination VARCHAR(100) NOT NULL,
  distance_km NUMERIC(10,2) NOT NULL CHECK (distance_km > 0),
  cargo_weight_kg NUMERIC(10,2) NOT NULL CHECK (cargo_weight_kg > 0),
  shipment_date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS shipment_assignments (
  shipment_id INT NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
  driver_id INT NOT NULL REFERENCES drivers(driver_id) ON DELETE RESTRICT,
  PRIMARY KEY (shipment_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_shipments_date ON shipments(shipment_date);
CREATE INDEX IF NOT EXISTS idx_shipments_vehicle ON shipments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(vehicle_type);
