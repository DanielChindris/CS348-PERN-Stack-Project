INSERT INTO emissions_factors (fuel_type, co2_per_km_per_kg)
VALUES
  ('Diesel', 0.00012),
  ('Gasoline', 0.00014),
  ('Electric', 0.00004)
ON CONFLICT (fuel_type) DO NOTHING;

INSERT INTO vehicles (model_name, vehicle_type, fuel_type, efficiency_rating)
VALUES
  ('Volvo FH16', 'Truck', 'Diesel', 3.50),
  ('Ford Transit', 'Van', 'Gasoline', 8.20),
  ('Tesla Semi', 'Truck', 'Electric', 2.80)
ON CONFLICT DO NOTHING;

INSERT INTO drivers (name, license_number, status)
VALUES
  ('Avery Scott', 'LIC-1001', 'ACTIVE'),
  ('Jordan Kim', 'LIC-1002', 'ACTIVE'),
  ('Morgan Lee', 'LIC-1003', 'ON_LEAVE')
ON CONFLICT (license_number) DO NOTHING;

INSERT INTO shipments (vehicle_id, origin, destination, distance_km, cargo_weight_kg, shipment_date)
VALUES
  (1, 'Chicago', 'Indianapolis', 300, 2500, '2026-01-10'),
  (2, 'Lafayette', 'Cincinnati', 220, 1400, '2026-01-15'),
  (3, 'Columbus', 'Detroit', 320, 2000, '2026-01-20')
ON CONFLICT DO NOTHING;

INSERT INTO shipment_assignments (shipment_id, driver_id)
VALUES
  (1, 1),
  (2, 2),
  (3, 1)
ON CONFLICT DO NOTHING;
