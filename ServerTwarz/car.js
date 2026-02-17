const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 5010;

// 🔗 Adres serwera twarzy — komunikacja przez HTTP, nie przez plik bazy
const FACES_API = 'http://localhost:5000/api';

// ⚙️ Konfiguracja
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// 🗄️ Własna baza danych car.db (absolutna ścieżka)
// ============================================================
const DB_PATH = path.join(__dirname, 'car.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Błąd bazy danych car.db:', err.message);
    process.exit(1);
  }
  console.log(`✅ Baza danych car.db połączona`);
  console.log(`   Lokalizacja: ${DB_PATH}`);
  initializeDatabase();
});

// Pomocnicze funkcje async
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}
function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}
function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// ============================================================
// 🌐 Pobieranie danych właściciela przez HTTP z serwera twarzy
// ============================================================
async function fetchOwnerFromFacesServer(pesel) {
  if (!pesel) return null;
  try {
    const res = await fetch(`${FACES_API}/faces/${pesel}`, {
      signal: AbortSignal.timeout(3000) // 3s timeout — nie blokuje gdy serwer offline
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.Sukces || !data.Osoba) return null;
    return {
      Pesel: pesel,
      Imie: data.Osoba.Imie,
      Nazwisko: data.Osoba.Nazwisko,
      DataUrodzenia: data.Osoba.DataUrodzenia,
      Plec: data.Osoba.Plec,
      ZdjęciePath: data.Osoba.SciezkaZdjecia
    };
  } catch (e) {
    // Serwer twarzy offline lub timeout — zwracamy null, nie crashujemy
    return null;
  }
}

async function enrichWithOwners(vehicle) {
  const [wlasciciel, drugiWlasciciel] = await Promise.all([
    fetchOwnerFromFacesServer(vehicle.wlasciciel_pesel),
    vehicle.drugi_wlasciciel_pesel
      ? fetchOwnerFromFacesServer(vehicle.drugi_wlasciciel_pesel)
      : Promise.resolve(null)
  ]);

  return {
    ...vehicle,
    Wlasciciel: wlasciciel || { Pesel: vehicle.wlasciciel_pesel, Imie: null, Nazwisko: null },
    DrugiWlasciciel: drugiWlasciciel
      || (vehicle.drugi_wlasciciel_pesel ? { Pesel: vehicle.drugi_wlasciciel_pesel } : null)
  };
}

// ============================================================
// 📊 Inicjalizacja tabel
// ============================================================
async function initializeDatabase() {
  try {
    await runAsync(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id TEXT PRIMARY KEY,
        vin TEXT UNIQUE NOT NULL,
        nr_rejestracji TEXT UNIQUE NOT NULL,
        marka TEXT NOT NULL,
        model TEXT NOT NULL,
        generacja TEXT,
        kolor TEXT NOT NULL,
        rok_produkcji INTEGER NOT NULL,
        data_pierwszej_rejestracji DATE NOT NULL,
        miejsce_rejestracji TEXT NOT NULL,
        typ_nadwozia TEXT,
        pojemnosc_silnika INTEGER,
        moc_kw INTEGER,
        paliwo TEXT DEFAULT 'benzyna',
        przebieg INTEGER DEFAULT 0,
        stan TEXT DEFAULT 'aktywny',
        uwagi TEXT,
        wlasciciel_pesel TEXT NOT NULL,
        drugi_wlasciciel_pesel TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS vehicle_ownership_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id TEXT NOT NULL,
        pesel TEXT NOT NULL,
        imie TEXT,
        nazwisko TEXT,
        data_od DATE NOT NULL,
        data_do DATE,
        typ TEXT DEFAULT 'glowny',
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS vehicle_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id TEXT NOT NULL,
        typ_zdarzenia TEXT NOT NULL,
        opis TEXT,
        data_zdarzenia DATE NOT NULL,
        koszt REAL,
        instytucja TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS vehicle_activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        vehicle_id TEXT,
        nr_rejestracji TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Tabele bazy danych gotowe');

    const count = await getAsync('SELECT COUNT(*) as cnt FROM vehicles');
    if (count.cnt === 0) await seedSampleData();

  } catch (err) {
    console.error('❌ Błąd inicjalizacji tabel:', err.message);
  }
}

async function logActivity(actionType, vehicleId = null, nrRejestracji = null, details = null) {
  try {
    await runAsync(
      `INSERT INTO vehicle_activity_logs (action_type, vehicle_id, nr_rejestracji, details) VALUES (?, ?, ?, ?)`,
      [actionType, vehicleId, nrRejestracji, details]
    );
  } catch (err) {
    console.error('Błąd logowania aktywności:', err.message);
  }
}

// 🌱 Przykładowe dane startowe
async function seedSampleData() {
  const vehicles = [
    {
      id: uuidv4(), vin: 'WBA3A5G59DNP26082', nr_rejestracji: 'WA12345',
      marka: 'BMW', model: '3 Series', generacja: 'F30', kolor: 'Czarny',
      rok_produkcji: 2013, data_pierwszej_rejestracji: '2013-03-15',
      miejsce_rejestracji: 'Warszawa', typ_nadwozia: 'Sedan',
      pojemnosc_silnika: 1995, moc_kw: 135, paliwo: 'benzyna',
      przebieg: 145000, stan: 'aktywny',
      wlasciciel_pesel: '85010112345', drugi_wlasciciel_pesel: null
    },
    {
      id: uuidv4(), vin: 'WAUZZZ4G2CN065443', nr_rejestracji: 'KR98765',
      marka: 'Audi', model: 'A4', generacja: 'B8', kolor: 'Srebrny',
      rok_produkcji: 2012, data_pierwszej_rejestracji: '2012-07-20',
      miejsce_rejestracji: 'Kraków', typ_nadwozia: 'Kombi',
      pojemnosc_silnika: 1968, moc_kw: 105, paliwo: 'diesel',
      przebieg: 210000, stan: 'aktywny',
      wlasciciel_pesel: '90051567890', drugi_wlasciciel_pesel: '85010112345'
    },
    {
      id: uuidv4(), vin: 'VSSZZZ6KZKR091879', nr_rejestracji: 'GD55512',
      marka: 'SEAT', model: 'Leon', generacja: 'III', kolor: 'Biały',
      rok_produkcji: 2019, data_pierwszej_rejestracji: '2019-01-10',
      miejsce_rejestracji: 'Gdańsk', typ_nadwozia: 'Hatchback',
      pojemnosc_silnika: 1498, moc_kw: 96, paliwo: 'benzyna',
      przebieg: 55000, stan: 'aktywny',
      wlasciciel_pesel: '95110278901', drugi_wlasciciel_pesel: null
    }
  ];

  for (const v of vehicles) {
    await runAsync(`
      INSERT INTO vehicles (id, vin, nr_rejestracji, marka, model, generacja, kolor,
        rok_produkcji, data_pierwszej_rejestracji, miejsce_rejestracji, typ_nadwozia,
        pojemnosc_silnika, moc_kw, paliwo, przebieg, stan, wlasciciel_pesel, drugi_wlasciciel_pesel)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [v.id, v.vin, v.nr_rejestracji, v.marka, v.model, v.generacja, v.kolor,
        v.rok_produkcji, v.data_pierwszej_rejestracji, v.miejsce_rejestracji,
        v.typ_nadwozia, v.pojemnosc_silnika, v.moc_kw, v.paliwo, v.przebieg,
        v.stan, v.wlasciciel_pesel, v.drugi_wlasciciel_pesel]);
  }
  console.log('🌱 Przykładowe pojazdy dodane do car.db');
}

// ============================================================
// 🚗 POJAZDY — CRUD
// ============================================================

// GET - Lista pojazdów
app.get('/api/vehicles', async (req, res) => {
  try {
    const { search, marka, stan, paliwo } = req.query;
    let sql = 'SELECT * FROM vehicles WHERE 1=1';
    const params = [];

    if (search) {
      sql += ` AND (nr_rejestracji LIKE ? OR vin LIKE ? OR marka LIKE ? OR model LIKE ? OR wlasciciel_pesel LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }
    if (marka)  { sql += ' AND marka = ?';  params.push(marka); }
    if (stan)   { sql += ' AND stan = ?';   params.push(stan); }
    if (paliwo) { sql += ' AND paliwo = ?'; params.push(paliwo); }
    sql += ' ORDER BY created_at DESC';

    const vehicles = await allAsync(sql, params);
    const enriched = await Promise.all(vehicles.map(v => enrichWithOwners(v)));

    res.json({ Sukces: true, Pojazdy: enriched, Ilosc: enriched.length });
  } catch (error) {
    res.status(500).json({ Sukces: false, Wiadomosc: error.message });
  }
});

// GET - Szczegóły pojazdu (po id, nr_rejestracji lub VIN)
app.get('/api/vehicles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const vehicle = await getAsync(
      'SELECT * FROM vehicles WHERE id = ? OR nr_rejestracji = ? OR vin = ?',
      [id, id, id]
    );
    if (!vehicle) {
      return res.status(404).json({ Sukces: false, Wiadomosc: 'Pojazd nie znaleziony' });
    }

    const [events, history, enriched] = await Promise.all([
      allAsync('SELECT * FROM vehicle_events WHERE vehicle_id = ? ORDER BY data_zdarzenia DESC', [vehicle.id]),
      allAsync('SELECT * FROM vehicle_ownership_history WHERE vehicle_id = ? ORDER BY data_od DESC', [vehicle.id]),
      enrichWithOwners(vehicle)
    ]);

    await logActivity('VIEW_VEHICLE', vehicle.id, vehicle.nr_rejestracji,
      `Przeglądano: ${vehicle.marka} ${vehicle.model}`);

    res.json({
      Sukces: true,
      Pojazd: { ...enriched, Zdarzenia: events, HistoriaWlascicieli: history }
    });
  } catch (error) {
    res.status(500).json({ Sukces: false, Wiadomosc: error.message });
  }
});

// POST - Dodaj pojazd
app.post('/api/vehicles', async (req, res) => {
  try {
    const {
      vin, nr_rejestracji, marka, model, generacja, kolor,
      rok_produkcji, data_pierwszej_rejestracji, miejsce_rejestracji,
      typ_nadwozia, pojemnosc_silnika, moc_kw, paliwo, przebieg,
      stan, uwagi, wlasciciel_pesel, drugi_wlasciciel_pesel
    } = req.body;

    if (!vin || !nr_rejestracji || !marka || !model || !kolor ||
        !rok_produkcji || !data_pierwszej_rejestracji || !miejsce_rejestracji || !wlasciciel_pesel) {
      return res.status(400).json({ Sukces: false, Wiadomosc: 'Brakuje wymaganych pól' });
    }

    const existingVin = await getAsync('SELECT id FROM vehicles WHERE vin = ?', [vin.toUpperCase()]);
    if (existingVin) return res.status(400).json({ Sukces: false, Wiadomosc: 'VIN już istnieje w bazie' });

    const existingNr = await getAsync('SELECT id FROM vehicles WHERE nr_rejestracji = ?', [nr_rejestracji.toUpperCase()]);
    if (existingNr) return res.status(400).json({ Sukces: false, Wiadomosc: 'Nr rejestracyjny już istnieje' });

    const id = uuidv4();

    await runAsync(`
      INSERT INTO vehicles (id, vin, nr_rejestracji, marka, model, generacja, kolor,
        rok_produkcji, data_pierwszej_rejestracji, miejsce_rejestracji, typ_nadwozia,
        pojemnosc_silnika, moc_kw, paliwo, przebieg, stan, uwagi, wlasciciel_pesel, drugi_wlasciciel_pesel)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, vin.toUpperCase(), nr_rejestracji.toUpperCase(), marka, model,
        generacja || null, kolor, parseInt(rok_produkcji), data_pierwszej_rejestracji,
        miejsce_rejestracji, typ_nadwozia || null, pojemnosc_silnika || null,
        moc_kw || null, paliwo || 'benzyna', parseInt(przebieg) || 0,
        stan || 'aktywny', uwagi || null, wlasciciel_pesel, drugi_wlasciciel_pesel || null]);

    await runAsync(
      `INSERT INTO vehicle_ownership_history (vehicle_id, pesel, data_od, typ) VALUES (?, ?, ?, 'glowny')`,
      [id, wlasciciel_pesel, data_pierwszej_rejestracji]
    );
    if (drugi_wlasciciel_pesel) {
      await runAsync(
        `INSERT INTO vehicle_ownership_history (vehicle_id, pesel, data_od, typ) VALUES (?, ?, ?, 'wspolwlasciciel')`,
        [id, drugi_wlasciciel_pesel, data_pierwszej_rejestracji]
      );
    }

    await logActivity('ADD_VEHICLE', id, nr_rejestracji.toUpperCase(),
      `Dodano ${marka} ${model} VIN:${vin.toUpperCase()}`);

    console.log(`✅ Dodano pojazd: ${nr_rejestracji.toUpperCase()} — ${marka} ${model}`);

    res.status(201).json({
      Sukces: true,
      Wiadomosc: `Pojazd ${marka} ${model} zarejestrowany`,
      Id: id,
      NrRejestracji: nr_rejestracji.toUpperCase()
    });
  } catch (error) {
    res.status(500).json({ Sukces: false, Wiadomosc: error.message });
  }
});

// PUT - Aktualizuj pojazd
app.put('/api/vehicles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const vehicle = await getAsync('SELECT * FROM vehicles WHERE id = ?', [id]);
    if (!vehicle) return res.status(404).json({ Sukces: false, Wiadomosc: 'Pojazd nie znaleziony' });

    const allowedFields = ['kolor', 'marka', 'model', 'generacja', 'rok_produkcji',
      'typ_nadwozia', 'pojemnosc_silnika', 'moc_kw', 'paliwo', 'przebieg', 'stan',
      'uwagi', 'miejsce_rejestracji', 'wlasciciel_pesel', 'drugi_wlasciciel_pesel'];

    const updates = [];
    const params = [];
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
    });

    if (updates.length === 0) {
      return res.status(400).json({ Sukces: false, Wiadomosc: 'Brak danych do aktualizacji' });
    }

    updates.push(`updated_at = datetime('now')`);
    params.push(id);

    await runAsync(`UPDATE vehicles SET ${updates.join(', ')} WHERE id = ?`, params);
    await logActivity('UPDATE_VEHICLE', id, vehicle.nr_rejestracji, `Zaktualizowano pojazd`);

    res.json({ Sukces: true, Wiadomosc: 'Pojazd zaktualizowany' });
  } catch (error) {
    res.status(500).json({ Sukces: false, Wiadomosc: error.message });
  }
});

// DELETE - Usuń pojazd
app.delete('/api/vehicles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const vehicle = await getAsync('SELECT * FROM vehicles WHERE id = ?', [id]);
    if (!vehicle) return res.status(404).json({ Sukces: false, Wiadomosc: 'Pojazd nie znaleziony' });

    await runAsync('DELETE FROM vehicle_events WHERE vehicle_id = ?', [id]);
    await runAsync('DELETE FROM vehicle_ownership_history WHERE vehicle_id = ?', [id]);
    await runAsync('DELETE FROM vehicles WHERE id = ?', [id]);

    await logActivity('DELETE_VEHICLE', id, vehicle.nr_rejestracji,
      `Usunięto ${vehicle.marka} ${vehicle.model}`);

    console.log(`🗑️ Usunięto pojazd: ${vehicle.nr_rejestracji}`);
    res.json({ Sukces: true, Wiadomosc: 'Pojazd usunięty' });
  } catch (error) {
    res.status(500).json({ Sukces: false, Wiadomosc: error.message });
  }
});

// ============================================================
// 📋 ZDARZENIA POJAZDU
// ============================================================

app.get('/api/vehicles/:id/events', async (req, res) => {
  try {
    const events = await allAsync(
      'SELECT * FROM vehicle_events WHERE vehicle_id = ? ORDER BY data_zdarzenia DESC',
      [req.params.id]
    );
    res.json({ Sukces: true, Zdarzenia: events });
  } catch (error) {
    res.status(500).json({ Sukces: false, Wiadomosc: error.message });
  }
});

app.post('/api/vehicles/:id/events', async (req, res) => {
  try {
    const { id } = req.params;
    const { typ_zdarzenia, opis, data_zdarzenia, koszt, instytucja } = req.body;

    if (!typ_zdarzenia || !data_zdarzenia) {
      return res.status(400).json({ Sukces: false, Wiadomosc: 'Wymagane: typ_zdarzenia, data_zdarzenia' });
    }

    const result = await runAsync(`
      INSERT INTO vehicle_events (vehicle_id, typ_zdarzenia, opis, data_zdarzenia, koszt, instytucja)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, typ_zdarzenia, opis || null, data_zdarzenia, koszt || null, instytucja || null]);

    res.status(201).json({ Sukces: true, Wiadomosc: 'Zdarzenie dodane', Id: result.lastID });
  } catch (error) {
    res.status(500).json({ Sukces: false, Wiadomosc: error.message });
  }
});

app.delete('/api/vehicles/:vehicleId/events/:eventId', async (req, res) => {
  try {
    await runAsync('DELETE FROM vehicle_events WHERE id = ? AND vehicle_id = ?',
      [req.params.eventId, req.params.vehicleId]);
    res.json({ Sukces: true, Wiadomosc: 'Zdarzenie usunięte' });
  } catch (error) {
    res.status(500).json({ Sukces: false, Wiadomosc: error.message });
  }
});

// ============================================================
// 👤 POJAZDY PO WŁAŚCICIELU
// ============================================================

app.get('/api/owner/:pesel/vehicles', async (req, res) => {
  try {
    const { pesel } = req.params;
    const [vehicles, owner] = await Promise.all([
      allAsync(
        'SELECT * FROM vehicles WHERE wlasciciel_pesel = ? OR drugi_wlasciciel_pesel = ? ORDER BY created_at DESC',
        [pesel, pesel]
      ),
      fetchOwnerFromFacesServer(pesel)
    ]);

    res.json({
      Sukces: true,
      Wlasciciel: owner || { Pesel: pesel },
      Pojazdy: vehicles,
      Ilosc: vehicles.length
    });
  } catch (error) {
    res.status(500).json({ Sukces: false, Wiadomosc: error.message });
  }
});

// ============================================================
// 📊 STATYSTYKI
// ============================================================

app.get('/api/stats', async (req, res) => {
  try {
    const [total, active, stolen, scrapped, byBrand, byFuel, byYear] = await Promise.all([
      getAsync('SELECT COUNT(*) as c FROM vehicles'),
      getAsync(`SELECT COUNT(*) as c FROM vehicles WHERE stan = 'aktywny'`),
      getAsync(`SELECT COUNT(*) as c FROM vehicles WHERE stan = 'skradziony'`),
      getAsync(`SELECT COUNT(*) as c FROM vehicles WHERE stan = 'złomowany'`),
      allAsync('SELECT marka, COUNT(*) as c FROM vehicles GROUP BY marka ORDER BY c DESC LIMIT 10'),
      allAsync('SELECT paliwo, COUNT(*) as c FROM vehicles GROUP BY paliwo ORDER BY c DESC'),
      allAsync('SELECT rok_produkcji, COUNT(*) as c FROM vehicles GROUP BY rok_produkcji ORDER BY rok_produkcji DESC LIMIT 10')
    ]);

    res.json({
      Sukces: true,
      Statystyki: {
        Razem:     total?.c   || 0,
        Aktywne:   active?.c  || 0,
        Skradzione: stolen?.c || 0,
        Zlomowane: scrapped?.c || 0,
        WgMarki:   byBrand,
        WgPaliwa:  byFuel,
        WgRoku:    byYear
      }
    });
  } catch (error) {
    res.status(500).json({ Sukces: false, Wiadomosc: error.message });
  }
});

// ============================================================
// 🔍 WYSZUKIWANIE
// ============================================================

app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ Sukces: false, Wiadomosc: 'Brakuje parametru q' });

    const term = `%${q.toUpperCase()}%`;
    const results = await allAsync(`
      SELECT id, vin, nr_rejestracji, marka, model, generacja, kolor, rok_produkcji, stan, wlasciciel_pesel
      FROM vehicles
      WHERE UPPER(nr_rejestracji) LIKE ? OR UPPER(vin) LIKE ? OR UPPER(marka) LIKE ? OR UPPER(model) LIKE ?
      LIMIT 20
    `, [term, term, term, term]);

    res.json({ Sukces: true, Wyniki: results, Ilosc: results.length });
  } catch (error) {
    res.status(500).json({ Sukces: false, Wiadomosc: error.message });
  }
});

// ============================================================
// 📋 LOGI AKTYWNOŚCI
// ============================================================

app.get('/api/activity-logs', async (req, res) => {
  try {
    const logs = await allAsync(
      'SELECT * FROM vehicle_activity_logs ORDER BY created_at DESC LIMIT 200'
    );
    res.json({ Sukces: true, Logi: logs });
  } catch (error) {
    res.status(500).json({ Sukces: false, Wiadomosc: error.message });
  }
});

// ============================================================
// 🔎 SZYBKIE WYSZUKANIE POJAZDU PO NR REJESTRACJI (dla mandatów)
// Używane przez serwer twarzy (port 5000) przy wystawianiu mandatów
// ============================================================

app.get('/api/vehicles/by-plate/:nr', async (req, res) => {
  try {
    const nr = req.params.nr.toUpperCase().replace(/\s/g, '');
    const vehicle = await getAsync(`
      SELECT id, vin, nr_rejestracji, marka, model, generacja, kolor,
       rok_produkcji, typ_nadwozia, pojemnosc_silnika, moc_kw,
       paliwo, przebieg, stan, uwagi,
       wlasciciel_pesel, drugi_wlasciciel_pesel
      FROM vehicles
      WHERE UPPER(REPLACE(nr_rejestracji,' ','')) = ?
    `, [nr]);

    if (!vehicle) {
      return res.status(404).json({ Sukces: false, Wiadomosc: 'Pojazd nie znaleziony' });
    }

    // Dociągnij dane właścicieli z serwera twarzy
    const enriched = await enrichWithOwners(vehicle);

    res.json({ Sukces: true, Pojazd: enriched });
  } catch (error) {
    res.status(500).json({ Sukces: false, Wiadomosc: error.message });
  }
});

// ============================================================
// 📡 API Info
// ============================================================

app.get('/api', (req, res) => {
  res.json({
    name: '🚗 Vehicle Registry API',
    version: '1.1.0',
    port: PORT,
    database: 'car.db',
    facesServer: FACES_API
  });
});

// ============================================================
// 🚀 Start
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║  🚗 Vehicle Registry Server                   ║
║  🚀 Port: ${PORT}                                ║
║  📍 http://localhost:${PORT}                     ║
║  💾 SQLite: car.db (własna baza)               ║
║  🔗 Twarze: http://localhost:5000/api          ║
╚═══════════════════════════════════════════════╝
  `);
});