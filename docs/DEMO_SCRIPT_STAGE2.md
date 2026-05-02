# TraceGreen Logistics - Stage 2 Demo Script
## 5-15 Minute Presentation

---

## PART 1: DATABASE DESIGN (1-2 minutes)

### Overview
"Our application manages carbon emissions tracking for logistics operations using a **relational PostgreSQL database** with 5 interconnected tables."

### Database Schema to Display
Show the schema file or display these tables in the terminal via `psql`:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

### Key Design Elements to Present

**Table: VEHICLES** (Primary table for CRUD demo)
```sql
CREATE TABLE vehicles (
  vehicle_id SERIAL PRIMARY KEY,
  model_name VARCHAR(100) NOT NULL,
  vehicle_type VARCHAR(50) NOT NULL,
  fuel_type VARCHAR(50) NOT NULL,
  efficiency_rating NUMERIC(8,2) NOT NULL
);
```
- Store vehicle fleet information
- Efficiency_rating used for fuel consumption calculations

**Table: DRIVERS**
```sql
CREATE TABLE drivers (
  driver_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  license_number VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(30) CHECK (status IN ('ACTIVE', 'INACTIVE', 'ON_LEAVE'))
);
```
- Track driver information with unique license enforcement

**Table: SHIPMENTS** (Fact table; used for reporting)
```sql
CREATE TABLE shipments (
  shipment_id SERIAL PRIMARY KEY,
  vehicle_id INT NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE RESTRICT,
  origin VARCHAR(100) NOT NULL,
  destination VARCHAR(100) NOT NULL,
  distance_km NUMERIC(10,2) NOT NULL,
  cargo_weight_kg NUMERIC(10,2) NOT NULL,
  shipment_date DATE NOT NULL
);
```
- Central fact table linking vehicles to shipments
- Foreign key ensures shipment records cannot exist without a valid vehicle

**Table: SHIPMENT_ASSIGNMENTS**
```sql
CREATE TABLE shipment_assignments (
  shipment_id INT NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
  driver_id INT NOT NULL REFERENCES drivers(driver_id) ON DELETE RESTRICT,
  PRIMARY KEY (shipment_id, driver_id)
);
```
- Many-to-many relationship between shipments and drivers
- CASCADE on shipment deletion ensures cleanup

**Table: EMISSIONS_FACTORS**
```sql
CREATE TABLE emissions_factors (
  factor_id SERIAL PRIMARY KEY,
  fuel_type VARCHAR(50) UNIQUE NOT NULL,
  co2_per_km_per_kg NUMERIC(12,8) NOT NULL
);
```
- Lookup table for calculation: CO2 emissions per km per kg of cargo

### Indexes
- `idx_shipments_date` — Fast filtering by shipment date (used in reports)
- `idx_shipments_vehicle` — Fast joins and vehicle-based queries
- `idx_vehicles_type` — Fast filtering by vehicle type in dropdowns

### Relationships Diagram (Verbal Description)
```
DRIVERS ──┐
          ├──→ SHIPMENT_ASSIGNMENTS ←──── SHIPMENTS ←──── VEHICLES
          │         (1:Many)              (joins)        (referenced)
          └──→ (ON DELETE RESTRICT)

VEHICLES ──→ EMISSIONS_FACTORS (via fuel_type join)
```

**Key constraints:**
- All foreign key relationships use ON DELETE RESTRICT or CASCADE to maintain referential integrity
- Unique constraints on license_number and fuel_type prevent duplicate entries

---

## PART 2: REQUIREMENT 1 — CRUD OPERATIONS (4-5 minutes)

### Objective
Demonstrate **Create, Read, Update, Delete** operations on the VEHICLES table.

### Setup: Show Current Data
**Step 1: Display current vehicles via the UI**
1. Open the application in browser: `http://localhost:5173`
2. Navigate to **Shipment Management** tab
3. Click "Select vehicle" dropdown
4. **Show the initial 3 vehicles:**
   - Volvo FH16 (Truck, Diesel)
   - Ford Transit (Van, Gasoline)
   - Tesla Semi (Truck, Electric)

**Alternative: Show via database directly**
```sql
SELECT vehicle_id, model_name, vehicle_type, fuel_type, efficiency_rating 
FROM vehicles 
ORDER BY vehicle_id;
```
Expected output:
```
 vehicle_id |  model_name   | vehicle_type | fuel_type | efficiency_rating
────────────┼───────────────┼──────────────┼───────────┼──────────────────
          1 | Volvo FH16    | Truck        | Diesel    |              3.50
          2 | Ford Transit  | Van          | Gasoline  |              8.20
          3 | Tesla Semi    | Truck        | Electric  |              2.80
```

---

### CRUD Demo: CREATE (Insert a new vehicle)

**Step 2: Show the Frontend Create Flow**
1. In the UI, click "+ Add new vehicle"
2. The form reveals 4 input fields:
   - **Model name:** Textbox (user enters any name)
   - **Vehicle type:** Dropdown (shows predefined categories from database)
   - **Fuel type:** Dropdown (shows predefined categories from database)
   - **Efficiency rating:** Number field

3. **Enter values:**
   - Model name: `Mercedes Sprinter`
   - Vehicle type: Select `**Van**` (from dropdown)
   - Fuel type: Select `**Diesel**` (from dropdown)
   - Efficiency rating: `7.50`

4. Click "Save Vehicle"
5. **Show success message:** "Vehicle created and selected"
6. New vehicle appears in the dropdown

**Step 3: Show the Backend Code**
Display [backend/server.js](backend/server.js#L78-L106):
```javascript
app.post('/api/vehicles', async (req, res) => {
  const { model_name, vehicle_type, fuel_type, efficiency_rating } = req.body;

  // 1. Normalize inputs
  const modelName = String(model_name || '').trim();
  const resolvedVehicleType = vehicleTypeMap.get(normalizeLookupValue(vehicle_type));
  const resolvedFuelType = fuelTypeMap.get(normalizeLookupValue(fuel_type));
  const numericEfficiency = Number(efficiency_rating);

  // 2. Validate: required fields and data types
  if (!modelName || !resolvedVehicleType || !resolvedFuelType || !Number.isFinite(numericEfficiency)) {
    return res.status(400).json({ error: 'model_name, vehicle_type, fuel_type, and efficiency_rating are required' });
  }

  if (numericEfficiency <= 0) {
    return res.status(400).json({ error: 'efficiency_rating must be a positive number' });
  }

  // 3. Insert into database with prepared statement to prevent SQL injection
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
```

**Key points to highlight:**
- ✅ **Data validation:** Vehicle type and fuel type are validated against predefined categories (categoryMap) before insertion
- ✅ **Parameterized queries:** Uses `$1, $2, $3, $4` to prevent SQL injection
- ✅ **RETURNING clause:** Confirms the insert and returns the new vehicle_id
- ✅ **Error handling:** Returns appropriate HTTP status codes (400 for bad input, 500 for database errors)

---

### CRUD Demo: READ (Query data)

**Step 4: Show the Read Operation**
In the browser, the vehicle dropdown already displays all vehicles retrieved from the database.

**Show the Backend Code** [backend/server.js](backend/server.js#L31-L42):
```javascript
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
```

**Verify the query directly in psql:**
```sql
SELECT * FROM vehicles ORDER BY model_name;
```

---

### CRUD Demo: UPDATE (Modify a vehicle)

**Step 5: Update the Tesla Semi's efficiency rating**
1. Show the Tesla Semi vehicle in the current shipments table (or query):
   ```sql
   SELECT * FROM vehicles WHERE model_name = 'Tesla Semi';
   ```
   Current efficiency: `2.80`

2. **Option A: Update via SQL** (show the query)
   ```sql
   UPDATE vehicles 
   SET efficiency_rating = 3.10 
   WHERE vehicle_id = 3
   RETURNING *;
   ```

3. **Verify the update:**
   ```sql
   SELECT * FROM vehicles WHERE vehicle_id = 3;
   ```
   Result shows: efficiency_rating = `3.10`

**Show the Backend PUT endpoint** [backend/server.js](backend/server.js#L175-L205):
```javascript
app.put('/api/shipments/:id', async (req, res) => {
  const shipmentId = Number(req.params.id);
  const { vehicle_id, driver_id, origin, destination, distance_km, cargo_weight_kg, shipment_date } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const updatedShipment = await client.query(
      `UPDATE shipments
       SET vehicle_id = $1, origin = $2, destination = $3, 
           distance_km = $4, cargo_weight_kg = $5, shipment_date = $6
       WHERE shipment_id = $7
       RETURNING *`,
      [vehicle_id, origin, destination, distance_km, cargo_weight_kg, shipment_date, shipmentId]
    );
    
    await client.query('COMMIT');
    return res.json(updatedShipment.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});
```

**For direct vehicle update, show this SQL:**
```sql
UPDATE vehicles 
SET efficiency_rating = $1 
WHERE vehicle_id = $2 
RETURNING *;
```

---

### CRUD Demo: DELETE (Remove a record)

**Step 6: Delete the Mercedes Sprinter we just created**

**Option 1: Show via the UI (if available) or via SQL:**
```sql
DELETE FROM vehicles 
WHERE model_name = 'Mercedes Sprinter';
```

**Try to delete a vehicle with shipments (should fail):**
```sql
DELETE FROM vehicles 
WHERE vehicle_id = 1;  -- Volvo FH16 has shipments
```
**Expected error:** 
```
ERROR: update or delete on table "vehicles" violates foreign key constraint "shipments_vehicle_id_fkey" on table "shipments"
DETAIL: Key (vehicle_id)=(1) is still referenced from table shipments".
```

This demonstrates **referential integrity** — you cannot delete a vehicle that has shipments.

**Show the Backend DELETE endpoint** [backend/server.js](backend/server.js#L267-L287):
```javascript
app.delete('/api/shipments/:id', async (req, res) => {
  const shipmentId = Number(req.params.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // First delete assignments (CASCADE)
    await client.query('DELETE FROM shipment_assignments WHERE shipment_id = $1', [shipmentId]);
    // Then delete shipment
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
```

**Key points:**
- ✅ **Transaction safety:** Uses `BEGIN`, `COMMIT`, `ROLLBACK` to ensure all-or-nothing deletion
- ✅ **CASCADE deletes:** Shipment_assignments auto-deleted when shipment is deleted
- ✅ **Referential integrity:** Foreign key constraints prevent orphaned records
- ✅ **Status codes:** Returns 404 if record not found, 500 if database error

---

## PART 3: REQUIREMENT 2 — FILTERING & REPORTING (4-5 minutes)

### Objective
Demonstrate **filtering data and generating a report** that shows before/after changes.

### Background
Your application calculates **CO2 emissions** for shipments based on:
```
CO2 (kg) = distance_km × cargo_weight_kg × emissions_factor (by fuel_type)
```

The **emissions report** filters by date range and vehicle type, then aggregates the data.

---

### Demo Setup: Show Initial Report

**Step 1: Generate Report BEFORE Changes**

1. In the browser, go to **Emissions Impact Report** tab
2. **Set filters:**
   - Start Date: `2026-01-01`
   - End Date: `2026-01-31`
   - Vehicle Type: `Truck` (from dropdown)
3. Click "Generate Report"

**Show the Results:**
```
Shipment Count: 2
Total CO2 (kg): 0.1920
Total Distance (km): 620.00
Average Emissions per km: 0.0003097

+────+──────────────+──────────+────────────────+────────────┬───────────┬──────────────+
| ID | Date         | Vehicle  | Fuel   | Route                    | Distance | Weight | CO2  |
+────+──────────────+──────────+────────+────────────────+────────────┬───────────┬──────────────+
| 1  | 2026-01-10   | Volvo...| Diesel | Chicago → Indianapolis | 300      | 2500   | 0.09 |
| 3  | 2026-01-20   | Tesla... | Elec  | Columbus → Detroit     | 320      | 2000   | 0.026|
+────+──────────────+──────────────────+────────────────+────────────┬───────────┬──────────────+
```

**Step 2: Show the Backend Report Query**
Display [backend/server.js](backend/server.js#L305-L340) — the emissions report endpoint:

```javascript
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

    // Aggregate statistics
    const stats = rows.reduce(
      (acc, row) => {
        acc.totalCo2Kg += Number(row.co2_kg);
        acc.totalDistanceKm += Number(row.distance_km);
        return acc;
      },
      { totalCo2Kg: 0, totalDistanceKm: 0 }
    );

    const shipmentCount = rows.length;
    const averageCo2PerKm = stats.totalDistanceKm > 0 ? stats.totalCo2Kg / stats.totalDistanceKm : 0;

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
```

**Key SQL features to highlight:**
- ✅ **JOINs:** Connects shipments → vehicles → emissions_factors
- ✅ **WHERE clause:** Filters by date range and vehicle type
- ✅ **Calculated column:** `(distance × weight × emission_factor) = CO2`
- ✅ **ORDER BY:** Sorts results chronologically
- ✅ **Aggregation:** JavaScript-side computation of totals and averages

---

### Make Data Changes

**Step 3: Add a New Shipment (to show impact)**

1. Go back to **Shipment Management** tab
2. Add a new shipment:
   - Vehicle: `Volvo FH16` (Truck, Diesel)
   - Driver: `Avery Scott`
   - Origin: `Indianapolis`
   - Destination: `Detroit`
   - Distance: `320 km`
   - Weight: `3000 kg`
   - Date: `2026-01-25`
3. Click "Create Shipment"

**Show the data insertion in the backend:**
```javascript
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
```

**Verify directly in database:**
```sql
SELECT shipment_id, origin, destination, distance_km, cargo_weight_kg, shipment_date 
FROM shipments 
WHERE shipment_date = '2026-01-25';
```

---

### Generate Report AFTER Changes

**Step 4: Run the Same Report Again**

1. Go to **Emissions Impact Report** tab
2. **Use same filters:**
   - Start Date: `2026-01-01`
   - End Date: `2026-01-31`
   - Vehicle Type: `Truck`
3. Click "Generate Report"

**Show the Updated Results:**
```
Shipment Count: 3  ← Increased from 2
Total CO2 (kg): 0.2568  ← Increased (new shipment added)
Total Distance (km): 940.00  ← Increased
Average Emissions per km: 0.0002732  ← Recalculated

+────+──────────────+──────────┬───────────────────────┬──────────┬────────┬──────────+
| ID | Date         | Vehicle  | Route                 | Distance | Weight | CO2      |
+────+──────────────+──────────┼───────────────────────┼──────────┼────────┼──────────+
| 1  | 2026-01-10   | Volvo... | Chicago → Indianap.. | 300      | 2500   | 0.0900   |
| 3  | 2026-01-20   | Tesla... | Columbus → Detroit    | 320      | 2000   | 0.0256   |
| 4  | 2026-01-25   | Volvo... | Indianapolis → Detroit| 320      | 3000   | 0.1152   | ← NEW
+────+──────────────+──────────┴───────────────────────┴──────────┴────────┴──────────+
```

**Analysis to present:**
- ✅ **Report reflects real-time changes:** New shipment immediately appears in results
- ✅ **Calculations update autonomously:** Aggregates recalculated without manual intervention
- ✅ **Data consistency maintained:** All calculations based on current database state

---

## PART 4: DYNAMIC UI FROM DATABASE (2-3 minutes)

### Objective
Show how interface dropdowns are **populated dynamically from the database** (not hardcoded).

---

### Dropdown 1: Vehicle Type Selection (Add New Vehicle)

**Step 1: Open the Add New Vehicle form**
1. In the **Shipment Management** tab, click "+ Add new vehicle"
2. Show the **Vehicle Type dropdown** with categories:
   - `Truck`, `Van`, `SUV`, `Sedan`, `Pickup`, `Bus`, `Motorcycle`
3. Explain: "These are NOT hardcoded in the frontend. Let's see where they come from."

**Show Backend Serving Options** [backend/server.js](backend/server.js#L8-10):
```javascript
const VEHICLE_TYPE_OPTIONS = ['Truck', 'Van', 'SUV', 'Sedan', 'Pickup', 'Bus', 'Motorcycle'];
const FUEL_TYPE_OPTIONS = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Hydrogen', 'CNG'];
```

Then the endpoint:
```javascript
app.get('/api/vehicle-options', (req, res) => {
  return res.json({
    vehicleTypes: VEHICLE_TYPE_OPTIONS,
    fuelTypes: FUEL_TYPE_OPTIONS
  });
});
```

**Verify the API response in terminal:**
```bash
curl http://localhost:3001/api/vehicle-options
```

**Expected output:**
```json
{
  "vehicleTypes": ["Truck", "Van", "SUV", "Sedan", "Pickup", "Bus", "Motorcycle"],
  "fuelTypes": ["Gasoline", "Diesel", "Electric", "Hybrid", "Hydrogen", "CNG"]
}
```

**Show Frontend Code** [frontend/src/App.jsx](frontend/src/App.jsx#L35-36):
```javascript
const [vehicleTypeOptions, setVehicleTypeOptions] = useState(DEFAULT_VEHICLE_TYPES);
const [fuelTypeOptions, setFuelTypeOptions] = useState(DEFAULT_FUEL_TYPES);
```

Load from backend in `loadInitialData()`:
```javascript
const vehicleOptionsData = await fetchJson(`${API_BASE}/vehicle-options`);

setVehicleTypeOptions(
  Array.isArray(vehicleOptionsData?.vehicleTypes) && vehicleOptionsData.vehicleTypes.length
    ? vehicleOptionsData.vehicleTypes
    : DEFAULT_VEHICLE_TYPES
);
```

**Render the dropdown dynamically** [frontend/src/App.jsx](frontend/src/App.jsx#L355-366):
```javascript
<select name="vehicle_type" value={newVehicle.vehicle_type} onChange={handleNewVehicleChange}>
  <option value="">Select vehicle type</option>
  {vehicleTypeOptions.map((type) => (
    <option key={type} value={type}>
      {type}
    </option>
  ))}
</select>
```

**Key point:** ✅ The `.map()` function loops through the array from the backend and creates `<option>` elements dynamically.

---

### Dropdown 2: Vehicle List (for Shipment Assignment)

**Step 2: Show the Vehicle Selection Dropdown**
1. In **Shipment Management**, show the **"Vehicle"** dropdown
2. Lists all vehicles: `Volvo FH16`, `Ford Transit`, `Tesla Semi`, `Mercedes Sprinter` (if created)
3. "This list is also populated from the database, not hardcoded."

**Show Backend Query** [backend/server.js](backend/server.js#L31-42):
```javascript
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
```

**Verify the query returns current data:**
```sql
SELECT vehicle_id, model_name FROM vehicles ORDER BY model_name;
```

**Show Frontend Rendering** [frontend/src/App.jsx](frontend/src/App.jsx#L341-345):
```javascript
{vehicles.map((v) => (
  <option key={v.vehicle_id} value={v.vehicle_id}>
    {v.model_name} ({v.vehicle_type}, {v.fuel_type})
  </option>
))}
```

**Key point:** ✅ The vehicle list automatically updates whenever a new vehicle is added (no page refresh needed).

---

### Dropdown 3: Driver List (for Shipment Assignment)

**Step 3: Show the Driver Selection Dropdown**
1. In **Shipment Management**, show the **"Driver"** dropdown
2. Lists active drivers: `Avery Scott`, `Jordan Kim`

**Show Backend Query** [backend/server.js](backend/server.js#L64-76):
```javascript
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
```

**Key feature:** ✅ **Filters for ACTIVE drivers only** — This is a database-side filter, not frontend UI filtering.

**Show Frontend Rendering** [frontend/src/App.jsx](frontend/src/App.jsx#L398-402):
```javascript
{drivers.map((d) => (
  <option key={d.driver_id} value={d.driver_id}>
    {d.name}
  </option>
))}
```

---

### Dropdown 4: Vehicle Type Filter (in Report)

**Step 4: Show the Report Filter Dropdown**
1. Go to **Emissions Impact Report** tab
2. Click the **"Vehicle Type"** dropdown
3. Shows categories: `Truck`, `Van`, `Electric` (derived from database), etc.

**Show Backend Query** [backend/server.js](backend/server.js#L44-55):
```javascript
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
```

**Key feature:** ✅ **Uses `DISTINCT`** — Returns only vehicle types that exist in the database, so the dropdown always reflects actual data.

**Show Frontend Rendering** [frontend/src/App.jsx](frontend/src/App.jsx#L520-526):
```javascript
<select name="vehicleType" value={reportFilters.vehicleType} onChange={handleReportFilterChange}>
  <option value="">Select type</option>
  {vehicleTypes.map((type) => (
    <option key={type} value={type}>
      {type}
    </option>
  ))}
</select>
```

---

## Summary of Dynamic UI Features

| Dropdown | Backend Source | Frontend Pattern | Notes |
|----------|---------|------|-------|
| Vehicle Type (Add) | `/api/vehicle-options` | `.map()` over state array | Predefined categories |
| Fuel Type (Add) | `/api/vehicle-options` | `.map()` over state array | Predefined categories |
| Vehicle List | `/api/vehicles` | `.map()` over DB rows | Updates automatically on creation |
| Driver List | `/api/drivers` | `.map()` over DB rows | Filters for ACTIVE status |
| Vehicle Type Filter (Report) | `/api/vehicle-types` | `.map()` over DISTINCT query | Uses actual DB values |

---

## Final Points to Emphasize

1. **No hardcoding:** Every dropdown is driven by either:
   - Backend-supplied constants (`/api/vehicle-options`)
   - Database queries (`SELECT * FROM vehicles`, `SELECT DISTINCT vehicle_type`)

2. **Real-time updates:** When you add a new vehicle, it immediately appears in all dropdowns without a page refresh.

3. **Data consistency:** The report can only filter by vehicle types that exist in the database.

4. **Database-driven architecture:**
   - Single source of truth is PostgreSQL
   - Backend validates and constrains values
   - Frontend simply renders what the backend provides

---

## Demo Checklist

### Before Demo Starts
- [ ] Backend running: `npm start` (from backend folder)
- [ ] Frontend running: `npm run dev` (from frontend folder)
- [ ] Database populated with seed data
- [ ] Have psql terminal open for direct queries
- [ ] Open browser to `http://localhost:5173`

### During Demo
- [ ] Show database tables (schema)
- [ ] CREATE: Insert Mercedes Sprinter vehicle (Van, Diesel, 7.50)
- [ ] READ: Display vehicles in dropdown
- [ ] UPDATE: Show SQL update, then refresh report
- [ ] DELETE: Attempt delete (show foreign key constraint)
- [ ] REPORT BEFORE: Run emissions report (Truck, Jan 2026)
- [ ] Add new shipment (Jan 25, Volvo FH16)
- [ ] REPORT AFTER: Run same report (shows new shipment)
- [ ] DYNAMIC UI: Show each dropdown and explain backend sources
  - Vehicle type dropdown source (`/api/vehicle-options`)
  - Vehicle list source (`/api/vehicles`)
  - Driver list source (`/api/drivers`)
  - Report filter source (`/api/vehicle-types`)

### After Demo
- [ ] Ask if there are questions about the code
- [ ] Highlight key architectural decisions:
  - Prepared statements for SQL injection prevention
  - Transaction usage for atomicity (CRUD operations)
  - Foreign key constraints for referential integrity
  - Real-time data binding (no hardcoded values)

---

## Estimated Timing

- **Database Design:** 1-2 min
- **CRUD Demo:** 4-5 min
  - CREATE: 1 min
  - READ: 0.5 min
  - UPDATE: 1 min
  - DELETE: 1.5 min
- **Filtering & Reporting:** 4-5 min
  - Initial report: 1 min
  - Changes + after report: 2 min
  - Analysis: 1-2 min
- **Dynamic UI:** 2-3 min
  - Show each dropdown: 0.5 × 4 = 2 min
  - Explain architecture: 1 min
- **Q&A / Buffer:** 1-2 min

**Total: 12-17 minutes** (fits within 5-15 minute requirement)

---

## Appendix: Quick Reference Queries

```sql
-- See all vehicles
SELECT * FROM vehicles;

-- See all drivers (including inactive)
SELECT * FROM drivers;

-- See all shipments with vehicle and driver info
SELECT s.*, v.model_name, d.name 
FROM shipments s
JOIN vehicles v ON s.vehicle_id = v.vehicle_id
LEFT JOIN shipment_assignments sa ON s.shipment_id = sa.shipment_id
LEFT JOIN drivers d ON sa.driver_id = d.driver_id;

-- Calculate emissions for a specific shipment
SELECT 
  s.shipment_id,
  s.distance_km,
  s.cargo_weight_kg,
  ef.co2_per_km_per_kg,
  (s.distance_km * s.cargo_weight_kg * ef.co2_per_km_per_kg) AS co2_kg
FROM shipments s
JOIN vehicles v ON s.vehicle_id = v.vehicle_id
JOIN emissions_factors ef ON v.fuel_type = ef.fuel_type
WHERE s.shipment_id = 1;

-- Show distinct vehicle types
SELECT DISTINCT vehicle_type FROM vehicles ORDER BY vehicle_type;

-- Delete a test vehicle (without cascading shipments)
DELETE FROM vehicles WHERE model_name = 'Mercedes Sprinter';
```
