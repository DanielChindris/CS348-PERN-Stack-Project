import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const DEFAULT_VEHICLE_TYPES = ['Truck', 'Van', 'SUV', 'Sedan', 'Pickup', 'Bus', 'Motorcycle'];
const DEFAULT_FUEL_TYPES = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Hydrogen', 'CNG'];

const initialForm = {
  vehicle_id: '',
  driver_id: '',
  origin: '',
  destination: '',
  distance_km: '',
  cargo_weight_kg: '',
  shipment_date: ''
};

const initialNewVehicle = {
  model_name: '',
  vehicle_type: '',
  fuel_type: '',
  efficiency_rating: ''
};

const initialNewDriver = {
  name: '',
  license_number: ''
};

function App() {
  const [tab, setTab] = useState('crud');
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState(DEFAULT_VEHICLE_TYPES);
  const [fuelTypeOptions, setFuelTypeOptions] = useState(DEFAULT_FUEL_TYPES);
  const [shipments, setShipments] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [newVehicle, setNewVehicle] = useState(initialNewVehicle);
  const [newDriver, setNewDriver] = useState(initialNewDriver);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  const [reportFilters, setReportFilters] = useState({
    startDate: '',
    endDate: '',
    vehicleType: ''
  });
  const [reportData, setReportData] = useState(null);

  const canSubmit = useMemo(() => {
    const hasSelectedVehicle = form.vehicle_id && form.vehicle_id !== '__new__';
    const hasSelectedDriver = !form.driver_id || form.driver_id !== '__new__';

    return (
      hasSelectedVehicle &&
      hasSelectedDriver &&
      form.origin &&
      form.destination &&
      form.distance_km &&
      form.cargo_weight_kg &&
      form.shipment_date
    );
  }, [form]);

  const overviewCards = [
    {
      label: 'Vehicles tracked',
      value: vehicles.length,
      note: 'Used in shipment creation and report joins'
    },
    {
      label: 'Active drivers',
      value: drivers.length,
      note: 'Selectable for new assignments'
    },
    {
      label: 'Shipments logged',
      value: shipments.length,
      note: 'Sorted newest-first in the main table'
    },
    {
      label: 'Vehicle types',
      value: vehicleTypes.length || vehicleTypeOptions.length,
      note: 'Drives the emissions report filter'
    }
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  const formatDate = (value) => {
    if (!value) {
      return '';
    }
    return String(value).slice(0, 10);
  };

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, options);
    const raw = await response.text();
    const contentType = response.headers.get('content-type') || '';

    let payload = null;
    if (raw) {
      if (contentType.includes('application/json')) {
        payload = JSON.parse(raw);
      } else {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = null;
        }
      }
    }

    if (!response.ok) {
      const apiMessage = payload?.error || payload?.status;
      if (apiMessage) {
        throw new Error(apiMessage);
      }

      if (raw && raw.trim().startsWith('<')) {
        throw new Error('Received HTML instead of JSON. Confirm the backend API server is running and API URL is correct.');
      }

      throw new Error(raw || `Request failed with status ${response.status}`);
    }

    return payload;
  };

  const loadInitialData = async () => {
    try {
      const [vehiclesData, driversData, shipmentsData, vehicleTypesData, vehicleOptionsData] = await Promise.all([
        fetchJson(`${API_BASE}/vehicles`),
        fetchJson(`${API_BASE}/drivers`),
        fetchJson(`${API_BASE}/shipments`),
        fetchJson(`${API_BASE}/vehicle-types`),
        fetchJson(`${API_BASE}/vehicle-options`)
      ]);

      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setDrivers(Array.isArray(driversData) ? driversData : []);
      setShipments(Array.isArray(shipmentsData) ? shipmentsData : []);
      setVehicleTypes(Array.isArray(vehicleTypesData) ? vehicleTypesData : []);
      setVehicleTypeOptions(
        Array.isArray(vehicleOptionsData?.vehicleTypes) && vehicleOptionsData.vehicleTypes.length
          ? vehicleOptionsData.vehicleTypes
          : DEFAULT_VEHICLE_TYPES
      );
      setFuelTypeOptions(
        Array.isArray(vehicleOptionsData?.fuelTypes) && vehicleOptionsData.fuelTypes.length
          ? vehicleOptionsData.fuelTypes
          : DEFAULT_FUEL_TYPES
      );
      setMessage('');
    } catch (error) {
      setVehicles([]);
      setDrivers([]);
      setShipments([]);
      setVehicleTypes([]);
      setVehicleTypeOptions(DEFAULT_VEHICLE_TYPES);
      setFuelTypeOptions(DEFAULT_FUEL_TYPES);
      setMessage(`Failed to load data: ${error.message}`);
    }
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    if (name === 'vehicle_id' && value !== '__new__') {
      setNewVehicle(initialNewVehicle);
    }

    if (name === 'driver_id' && value !== '__new__') {
      setNewDriver(initialNewDriver);
    }
  };

  const handleNewVehicleChange = (event) => {
    const { name, value } = event.target;
    setNewVehicle((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewDriverChange = (event) => {
    const { name, value } = event.target;
    setNewDriver((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(initialForm);
    setNewVehicle(initialNewVehicle);
    setNewDriver(initialNewDriver);
    setEditingId(null);
  };

  const createVehicle = async () => {
    if (
      !newVehicle.model_name ||
      !newVehicle.vehicle_type ||
      !newVehicle.fuel_type ||
      !newVehicle.efficiency_rating
    ) {
      setMessage('Complete all new vehicle fields first');
      return;
    }

    try {
      const payload = await fetchJson(`${API_BASE}/vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newVehicle,
          efficiency_rating: Number(newVehicle.efficiency_rating)
        })
      });

      await loadInitialData();
      setForm((prev) => ({ ...prev, vehicle_id: String(payload.vehicle_id) }));
      setNewVehicle(initialNewVehicle);
      setMessage('Vehicle created and selected');
    } catch (error) {
      setMessage(`Vehicle create failed: ${error.message}`);
    }
  };

  const createDriver = async () => {
    if (!newDriver.name || !newDriver.license_number) {
      setMessage('Complete all new driver fields first');
      return;
    }

    try {
      const payload = await fetchJson(`${API_BASE}/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newDriver,
          status: 'ACTIVE'
        })
      });

      await loadInitialData();
      setForm((prev) => ({ ...prev, driver_id: String(payload.driver_id) }));
      setNewDriver(initialNewDriver);
      setMessage('Driver created and selected');
    } catch (error) {
      setMessage(`Driver create failed: ${error.message}`);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    const payload = {
      ...form,
      vehicle_id: Number(form.vehicle_id),
      driver_id: form.driver_id ? Number(form.driver_id) : null,
      distance_km: Number(form.distance_km),
      cargo_weight_kg: Number(form.cargo_weight_kg)
    };

    const endpoint = editingId ? `${API_BASE}/shipments/${editingId}` : `${API_BASE}/shipments`;
    const method = editingId ? 'PUT' : 'POST';

    try {
      await fetchJson(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setMessage(editingId ? 'Shipment updated' : 'Shipment created');
      resetForm();
      await loadInitialData();
    } catch (error) {
      setMessage(`Save failed: ${error.message}`);
    }
  };

  const handleEdit = (shipment) => {
    setEditingId(shipment.shipment_id);
    setForm({
      vehicle_id: String(shipment.vehicle_id),
      driver_id: shipment.driver_id ? String(shipment.driver_id) : '',
      origin: shipment.origin,
      destination: shipment.destination,
      distance_km: String(shipment.distance_km),
      cargo_weight_kg: String(shipment.cargo_weight_kg),
      shipment_date: formatDate(shipment.shipment_date)
    });
    setTab('crud');
  };

  const handleDelete = async (shipmentId) => {
    const confirmed = window.confirm('Delete this shipment?');
    if (!confirmed) {
      return;
    }

    try {
      await fetchJson(`${API_BASE}/shipments/${shipmentId}`, { method: 'DELETE' });
      setMessage('Shipment deleted');
      await loadInitialData();
    } catch (error) {
      setMessage(`Delete failed: ${error.message}`);
    }
  };

  const handleReportFilterChange = (event) => {
    const { name, value } = event.target;
    setReportFilters((prev) => ({ ...prev, [name]: value }));
  };

  const runReport = async (event) => {
    event.preventDefault();
    setMessage('');

    if (!reportFilters.startDate || !reportFilters.endDate || !reportFilters.vehicleType) {
      setMessage('Report filters are required');
      return;
    }

    const query = new URLSearchParams(reportFilters).toString();
    try {
      const payload = await fetchJson(`${API_BASE}/reports/emissions?${query}`);
      setReportData(payload);
    } catch (error) {
      setMessage(`Report failed: ${error.message}`);
    }
  };

  return (
    <div className="app">
      <header className="header hero">
        <div className="hero-copy">
          <p className="eyebrow">CS348 PERN Stack Project</p>
          <h1>TraceGreen Logistics</h1>
          <p className="hero-subtitle">
            Track shipments, manage assignments, and generate an emissions report backed by
            parameterized SQL and transactional writes.
          </p>
        </div>

        <div className="hero-cards">
          {overviewCards.map((card) => (
            <article key={card.label} className="stat-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.note}</small>
            </article>
          ))}
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === 'crud' ? 'active' : ''} onClick={() => setTab('crud')}>
          Shipment Management
        </button>
        <button className={tab === 'report' ? 'active' : ''} onClick={() => setTab('report')}>
          Emissions Impact Report
        </button>
      </nav>

      {message ? <p className="message">{message}</p> : null}

      {tab === 'crud' ? (
        <section className="panel">
          <h2>{editingId ? 'Edit Shipment' : 'Add Shipment'}</h2>
          <form className="form" onSubmit={handleSubmit}>
            <label>
              Vehicle
              <select name="vehicle_id" value={form.vehicle_id} onChange={handleFormChange} required>
                <option value="">Select vehicle</option>
                <option value="__new__">+ Add new vehicle</option>
                {vehicles.map((v) => (
                  <option key={v.vehicle_id} value={v.vehicle_id}>
                    {v.model_name} ({v.vehicle_type}, {v.fuel_type})
                  </option>
                ))}
              </select>
              {form.vehicle_id === '__new__' ? (
                <div className="inline-create">
                  <input
                    name="model_name"
                    placeholder="Model name"
                    value={newVehicle.model_name}
                    onChange={handleNewVehicleChange}
                  />
                  <select
                    name="vehicle_type"
                    value={newVehicle.vehicle_type}
                    onChange={handleNewVehicleChange}
                  >
                    <option value="">Select vehicle type</option>
                    {vehicleTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <select
                    name="fuel_type"
                    value={newVehicle.fuel_type}
                    onChange={handleNewVehicleChange}
                  >
                    <option value="">Select fuel type</option>
                    {fuelTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <input
                    name="efficiency_rating"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Efficiency rating"
                    value={newVehicle.efficiency_rating}
                    onChange={handleNewVehicleChange}
                  />
                  <button type="button" onClick={createVehicle}>Save Vehicle</button>
                </div>
              ) : null}
            </label>

            <label>
              Driver (optional)
              <select name="driver_id" value={form.driver_id} onChange={handleFormChange}>
                <option value="">Unassigned</option>
                <option value="__new__">+ Add new driver</option>
                {drivers.map((d) => (
                  <option key={d.driver_id} value={d.driver_id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {form.driver_id === '__new__' ? (
                <div className="inline-create">
                  <input
                    name="name"
                    placeholder="Driver name"
                    value={newDriver.name}
                    onChange={handleNewDriverChange}
                  />
                  <input
                    name="license_number"
                    placeholder="License number"
                    value={newDriver.license_number}
                    onChange={handleNewDriverChange}
                  />
                  <button type="button" onClick={createDriver}>Save Driver</button>
                </div>
              ) : null}
            </label>

            <label>
              Origin
              <input name="origin" value={form.origin} onChange={handleFormChange} required />
            </label>

            <label>
              Destination
              <input name="destination" value={form.destination} onChange={handleFormChange} required />
            </label>

            <label>
              Distance (km)
              <input
                type="number"
                min="1"
                step="0.01"
                name="distance_km"
                value={form.distance_km}
                onChange={handleFormChange}
                required
              />
            </label>

            <label>
              Cargo Weight (kg)
              <input
                type="number"
                min="1"
                step="0.01"
                name="cargo_weight_kg"
                value={form.cargo_weight_kg}
                onChange={handleFormChange}
                required
              />
            </label>

            <label>
              Shipment Date
              <input
                type="date"
                name="shipment_date"
                value={form.shipment_date}
                onChange={handleFormChange}
                required
              />
            </label>

            <div className="form-actions">
              <button type="submit" disabled={!canSubmit}>
                {editingId ? 'Update Shipment' : 'Create Shipment'}
              </button>
              {editingId ? (
                <button type="button" className="secondary" onClick={resetForm}>
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>

          <h2>Current Shipments</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Vehicle</th>
                <th>Driver</th>
                <th>Route</th>
                <th>Distance (km)</th>
                <th>Weight (kg)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.shipment_id}>
                  <td data-label="ID">{s.shipment_id}</td>
                  <td data-label="Date">{formatDate(s.shipment_date)}</td>
                  <td data-label="Vehicle">{s.model_name}</td>
                  <td data-label="Driver">{s.driver_name || 'Unassigned'}</td>
                  <td data-label="Route">
                    {s.origin} to {s.destination}
                  </td>
                  <td data-label="Distance (km)">{s.distance_km}</td>
                  <td data-label="Weight (kg)">{s.cargo_weight_kg}</td>
                  <td data-label="Actions">
                    <button onClick={() => handleEdit(s)}>Edit</button>
                    <button className="danger" onClick={() => handleDelete(s.shipment_id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="panel">
          <h2>Emissions Impact Report</h2>
          <form className="form report" onSubmit={runReport}>
            <label>
              Start Date
              <input
                type="date"
                name="startDate"
                value={reportFilters.startDate}
                onChange={handleReportFilterChange}
              />
            </label>

            <label>
              End Date
              <input
                type="date"
                name="endDate"
                value={reportFilters.endDate}
                onChange={handleReportFilterChange}
              />
            </label>

            <label>
              Vehicle Type
              <select
                name="vehicleType"
                value={reportFilters.vehicleType}
                onChange={handleReportFilterChange}
              >
                <option value="">Select type</option>
                {vehicleTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit">Generate Report</button>
          </form>

          {reportData ? (
            <div className="report-output">
              <div className="stats">
                <p>
                  <strong>Shipment Count:</strong> {reportData.shipmentCount}
                </p>
                <p>
                  <strong>Total CO2 (kg):</strong> {reportData.totalCo2Kg}
                </p>
                <p>
                  <strong>Total Distance (km):</strong> {reportData.totalDistanceKm}
                </p>
                <p>
                  <strong>Average Emissions per km:</strong> {reportData.averageCo2PerKm}
                </p>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Vehicle</th>
                    <th>Fuel</th>
                    <th>Route</th>
                    <th>Distance (km)</th>
                    <th>Weight (kg)</th>
                    <th>CO2 (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(reportData.rows) ? reportData.rows : []).map((row) => (
                    <tr key={row.shipment_id}>
                      <td data-label="Date">{formatDate(row.shipment_date)}</td>
                      <td data-label="Vehicle">{row.model_name}</td>
                      <td data-label="Fuel">{row.fuel_type}</td>
                      <td data-label="Route">
                        {row.origin} to {row.destination}
                      </td>
                      <td data-label="Distance (km)">{row.distance_km}</td>
                      <td data-label="Weight (kg)">{row.cargo_weight_kg}</td>
                      <td data-label="CO2 (kg)">{Number(row.co2_kg).toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}

export default App;
