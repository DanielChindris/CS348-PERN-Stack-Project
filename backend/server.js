const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

const VEHICLE_TYPE_OPTIONS = ['Truck', 'Van', 'SUV', 'Sedan', 'Pickup', 'Bus', 'Motorcycle'];
const FUEL_TYPE_OPTIONS = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Hydrogen', 'CNG'];

const vehicleTypeMap = new Map(VEHICLE_TYPE_OPTIONS.map((value) => [value.toLowerCase(), value]));
const fuelTypeMap = new Map(FUEL_TYPE_OPTIONS.map((value) => [value.toLowerCase(), value]));

const normalizeLookupValue = (value) => String(value || '').trim().toLowerCase();

// Enable CORS
app.use(cors());

// Middleware to parse JSON
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'Backend and database are running' });
  } catch (error) {
    res.status(500).json({ status: 'Backend running, database unavailable', error: error.message });
  }
});

app.get('/api/vehicles', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT vehicle_id, model_name, vehicle_type, fuel_type, efficiency_rating
       FROM vehicles
       ORDER BY model_name`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vehicle-types', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT vehicle_type
       FROM vehicles
       ORDER BY vehicle_type`
    );
    res.json(result.rows.map((row) => row.vehicle_type));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vehicle-options', (req, res) => {
  return res.json({
    vehicleTypes: VEHICLE_TYPE_OPTIONS,
    fuelTypes: FUEL_TYPE_OPTIONS
  });
});

app.get('/api/drivers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT driver_id, name, license_number, status
       FROM drivers
       WHERE status = 'ACTIVE'
       ORDER BY name`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vehicles', async (req, res) => {
  const { model_name, vehicle_type, fuel_type, efficiency_rating } = req.body;

  const modelName = String(model_name || '').trim();
  const resolvedVehicleType = vehicleTypeMap.get(normalizeLookupValue(vehicle_type));
  const resolvedFuelType = fuelTypeMap.get(normalizeLookupValue(fuel_type));
  const numericEfficiency = Number(efficiency_rating);

  if (!modelName || !resolvedVehicleType || !resolvedFuelType || !Number.isFinite(numericEfficiency)) {
    return res.status(400).json({ error: 'model_name, vehicle_type, fuel_type, and efficiency_rating are required' });
  }

  if (numericEfficiency <= 0) {
    return res.status(400).json({ error: 'efficiency_rating must be a positive number' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO vehicles (model_name, vehicle_type, fuel_type, efficiency_rating)
       VALUES ($1, $2, $3, $4)
       RETURNING vehicle_id, model_name, vehicle_type, fuel_type, efficiency_rating`,
      [modelName, resolvedVehicleType, resolvedFuelType, numericEfficiency]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/drivers', async (req, res) => {
  const { name, license_number, status } = req.body;

  if (!name || !license_number) {
    return res.status(400).json({ error: 'name and license_number are required' });
  }

  const driverStatus = status || 'ACTIVE';

  try {
    const result = await pool.query(
      `INSERT INTO drivers (name, license_number, status)
       VALUES ($1, $2, $3)
       RETURNING driver_id, name, license_number, status`,
      [name, license_number, driverStatus]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/shipments', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        s.shipment_id,
        s.origin,
        s.destination,
        s.distance_km,
        s.cargo_weight_kg,
        s.shipment_date,
        s.vehicle_id,
        v.model_name,
        v.vehicle_type,
        v.fuel_type,
        sa.driver_id,
        d.name AS driver_name
      FROM shipments s
      JOIN vehicles v ON s.vehicle_id = v.vehicle_id
      LEFT JOIN shipment_assignments sa ON s.shipment_id = sa.shipment_id
      LEFT JOIN drivers d ON sa.driver_id = d.driver_id
      ORDER BY s.shipment_date DESC, s.shipment_id DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/shipments', async (req, res) => {
  const {
    vehicle_id,
    driver_id,
    origin,
    destination,
    distance_km,
    cargo_weight_kg,
    shipment_date
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');

    const shipmentResult = await client.query(
      `INSERT INTO shipments (vehicle_id, origin, destination, distance_km, cargo_weight_kg, shipment_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [vehicle_id, origin, destination, distance_km, cargo_weight_kg, shipment_date]
    );

    if (driver_id) {
      await client.query(
        `INSERT INTO shipment_assignments (shipment_id, driver_id)
         VALUES ($1, $2)`,
        [shipmentResult.rows[0].shipment_id, driver_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(shipmentResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.put('/api/shipments/:id', async (req, res) => {
  const shipmentId = Number(req.params.id);
  const {
    vehicle_id,
    driver_id,
    origin,
    destination,
    distance_km,
    cargo_weight_kg,
    shipment_date
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');

    const updatedShipment = await client.query(
      `UPDATE shipments
       SET vehicle_id = $1,
           origin = $2,
           destination = $3,
           distance_km = $4,
           cargo_weight_kg = $5,
           shipment_date = $6
       WHERE shipment_id = $7
       RETURNING *`,
      [vehicle_id, origin, destination, distance_km, cargo_weight_kg, shipment_date, shipmentId]
    );

    if (updatedShipment.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Shipment not found' });
    }

    await client.query('DELETE FROM shipment_assignments WHERE shipment_id = $1', [shipmentId]);

    if (driver_id) {
      await client.query(
        `INSERT INTO shipment_assignments (shipment_id, driver_id)
         VALUES ($1, $2)`,
        [shipmentId, driver_id]
      );
    }

    await client.query('COMMIT');
    return res.json(updatedShipment.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.delete('/api/shipments/:id', async (req, res) => {
  const shipmentId = Number(req.params.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await client.query('DELETE FROM shipment_assignments WHERE shipment_id = $1', [shipmentId]);
    const deletedShipment = await client.query(
      'DELETE FROM shipments WHERE shipment_id = $1 RETURNING *',
      [shipmentId]
    );
    await client.query('COMMIT');

    if (deletedShipment.rowCount === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    return res.json({ message: 'Shipment deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/reports/emissions', async (req, res) => {
  const { startDate, endDate, vehicleType } = req.query;

  if (!startDate || !endDate || !vehicleType) {
    return res.status(400).json({ error: 'startDate, endDate, and vehicleType are required' });
  }

  try {
    const reportQuery = `
      SELECT
        s.shipment_id,
        s.shipment_date,
        s.origin,
        s.destination,
        s.distance_km,
        s.cargo_weight_kg,
        v.model_name,
        v.vehicle_type,
        v.fuel_type,
        ef.co2_per_km_per_kg,
        (s.distance_km * s.cargo_weight_kg * ef.co2_per_km_per_kg) AS co2_kg
      FROM shipments s
      JOIN vehicles v ON s.vehicle_id = v.vehicle_id
      JOIN emissions_factors ef ON v.fuel_type = ef.fuel_type
      WHERE s.shipment_date BETWEEN $1 AND $2
        AND v.vehicle_type = $3
      ORDER BY s.shipment_date ASC, s.shipment_id ASC
    `;

    const rowsResult = await pool.query(reportQuery, [startDate, endDate, vehicleType]);
    const rows = rowsResult.rows;

    const stats = rows.reduce(
      (acc, row) => {
        acc.totalCo2Kg += Number(row.co2_kg);
        acc.totalDistanceKm += Number(row.distance_km);
        return acc;
      },
      { totalCo2Kg: 0, totalDistanceKm: 0 }
    );

    const shipmentCount = rows.length;
    const averageCo2PerKm =
      stats.totalDistanceKm > 0 ? stats.totalCo2Kg / stats.totalDistanceKm : 0;

    return res.json({
      filters: { startDate, endDate, vehicleType },
      shipmentCount,
      totalCo2Kg: Number(stats.totalCo2Kg.toFixed(4)),
      totalDistanceKm: Number(stats.totalDistanceKm.toFixed(2)),
      averageCo2PerKm: Number(averageCo2PerKm.toFixed(6)),
      rows
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
