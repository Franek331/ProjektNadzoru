const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // npm install jsonwebtoken
const SECRET_KEY = '1745618756195nfcsjnjbnv';

const app = express();
const PORT = 5000;
// 📁 Tworzenie folderów
const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      Sukces: false,
      Wiadomosc: 'Brak tokenu autoryzacji'
    });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      Sukces: false,
      Wiadomosc: 'Nieprawidłowy token'
    });
  }
}

// ⚙️ Konfiguracja
app.use(cors());
app.use(express.json());
app.use(express.json({ limit: '50mb' }));  
app.use(express.urlencoded({ limit: '50mb', extended: true })); 
app.use('/uploads', express.static(uploadsDir));

// ✅ OBSŁUGA STRON HTML - MUSI BYĆ PRZED app.use(express.static())
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/mandaty', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mandaty.html'));
});

app.get('/mandaty.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mandaty.html'));
});

// ✅ PLIKI STATYCZNE - MUSI BYĆ PO ROUTACH HTML
app.use(express.static(path.join(__dirname, 'public')));

// 🗄️ Inicjalizacja bazy danych SQLite
const db = new sqlite3.Database('faces.db', (err) => {
  if (err) {
    console.error('❌ Błąd bazy danych:', err);
  } else {
    console.log('✅ Baza danych SQLite połączona');
    initializeDatabase();
  }
});

// Funkcja do wykonania SQL z Promise
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
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

// Inicjalizacja tabel
async function initializeDatabase() {
  try {
    await runAsync(`
      CREATE TABLE IF NOT EXISTS faces (
        pesel TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        date_of_birth DATE NOT NULL,
        gender TEXT NOT NULL,
        embedding TEXT NOT NULL,
        photo_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await runAsync(`
      CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pesel TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        search_type TEXT NOT NULL,
        found BOOLEAN DEFAULT 0,
        searched_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
     await runAsync(`
      CREATE TABLE IF NOT EXISTS nfc_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pesel TEXT NOT NULL UNIQUE,
        nfc_uid TEXT UNIQUE,
        nfc_active BOOLEAN DEFAULT 1,
        registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pesel) REFERENCES faces(pesel) ON DELETE CASCADE
      )
    `);
 await runAsync(`
      CREATE TABLE IF NOT EXISTS security_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pesel TEXT NOT NULL UNIQUE,
        is_wanted BOOLEAN DEFAULT 0,
        is_blocked BOOLEAN DEFAULT 0,
        reason TEXT,
        alert_color TEXT DEFAULT 'green',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pesel) REFERENCES faces(pesel) ON DELETE CASCADE
      )
    `);
await runAsync(`
      CREATE TABLE IF NOT EXISTS security_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pesel TEXT NOT NULL,
        event_type TEXT NOT NULL,
        alert_color TEXT,
        detection_method TEXT,
        event_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pesel) REFERENCES faces(pesel)
      )
    `);

    await runAsync(`
  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_type TEXT DEFAULT 'admin',
    action_type TEXT NOT NULL,
    target_pesel TEXT,
    target_name TEXT,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
await runAsync(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    first_name TEXT,                  
    last_name TEXT,    
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'operator',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  )
`);
await runAsync(`
      CREATE TABLE IF NOT EXISTS raporty (
        id TEXT PRIMARY KEY,
        pesel TEXT NOT NULL,
        imie TEXT NOT NULL,
        nazwisko TEXT NOT NULL,
        data_urodzenia DATE,
        plec TEXT,
        pewnosc REAL,
        notatka TEXT,
        przeprowadzone_dzialania TEXT,
        czy_mandat BOOLEAN DEFAULT 0,
        kwota_mandatu REAL,
        numer_mandatu TEXT,
        typ_mandatu TEXT,
        status_mandatu TEXT,
        operator TEXT,
        data_wysylania DATETIME,
        status TEXT DEFAULT 'Nowy',
        pełne_imie TEXT,
        dane_podstawowe TEXT,
        dane_mandatu TEXT,
        data_raportu DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pesel) REFERENCES faces(pesel) ON DELETE CASCADE
  )
`);

await runAsync(`
    CREATE TABLE IF NOT EXISTS face_features (
    id INTEGER PRIMARY KEY,
    pesel TEXT UNIQUE,
    eye_color TEXT,        
    hair_color TEXT,      
    eye_distance REAL,     
    nose_width REAL,      
    mouth_width REAL,     
    eyebrow_shape TEXT,    
    skin_texture TEXT,     
    facial_asymmetry REAL, 
    age_estimate TEXT,     
    skin_tone TEXT,        
    features_json TEXT,    
    created_at DATETIME
  )
`);

    console.log('✅ Tabele bazy danych gotowe');

    const adminPasswordHash = await bcrypt.hash('Admin123', 10);
await runAsync(
 'INSERT OR IGNORE INTO users (username, first_name, last_name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
  ['Admin', 'Franek', 'Karpiuk', adminPasswordHash, 'admin']
  
);


  } catch (err) {
    console.error('❌ Błąd inicjalizacji bazy:', err);
  }
}

async function logActivity(actionType, targetPesel = null, targetName = null, details = null, userType = 'admin') {
  try {
    await runAsync(
      `INSERT INTO activity_logs (user_type, action_type, target_pesel, target_name, details) 
       VALUES (?, ?, ?, ?, ?)`,
      [userType, actionType, targetPesel, targetName, details]
    );
  } catch (error) {
    console.error('Błąd logowania aktywności:', error);
  }
}


// 📸 Konfiguracja Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = file.fieldname === 'fingerprint' ? fingerprintsDir : uploadsDir;
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});
// GET - Pobierz logi
app.get('/api/activity-logs', async (req, res) => {
  try {
    const limit = req.query.limit || 100;
    const logs = await allAsync(`
      SELECT id, user_type, action_type, target_pesel, target_name, details, created_at
      FROM activity_logs
      ORDER BY created_at DESC
      LIMIT ?
    `, [limit]);

    const formatted = logs.map(log => ({
      Id: log.id,
      TypUzytkownika: log.user_type,
      TypAkcji: log.action_type,
      Pesel: log.target_pesel,
      Nazwa: log.target_name,
      Szczegoly: log.details,
      Data: log.created_at
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});





app.post('/api/test/create-admin', async (req, res) => {
  try {
    // Usuń starego
    await runAsync('DELETE FROM users WHERE username = ?', ['Admin']);
    
    // Stwórz nowego
    const hash = await bcrypt.hash('Admin123', 10);
    await runAsync(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
      ['Admin', hash, 'admin']
    );

    res.json({
      Sukces: true,
      Wiadomosc: 'Admin stworzony',
      Logowanie: {
        Username: 'Admin',
        Password: 'Admin123'
      }
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});




// DELETE - Wyczyść logi
app.delete('/api/activity-logs', async (req, res) => {
  try {
    await runAsync('DELETE FROM activity_logs');
    res.json({
      Sukces: true,
      Wiadomosc: 'Logi aktywności wyczyszczone'
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// GET - Statystyki logów
app.get('/api/activity-logs/stats', async (req, res) => {
  try {
    const total = await getAsync('SELECT COUNT(*) as count FROM activity_logs');
    const byType = await allAsync(`
      SELECT action_type, COUNT(*) as count 
      FROM activity_logs 
      GROUP BY action_type 
      ORDER BY count DESC
    `);

    res.json({
      Sukces: true,
      Statystyki: {
        Lacznie: total?.count || 0,
        PoTypie: byType.map(t => ({
          Typ: t.action_type,
          Liczba: t.count
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|bmp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Tylko pliki obrazów są dozwolone!'));
  }
});

// 🧮 Funkcja generująca wektor twarzy
function generateMockEmbedding() {
  const embedding = [];
  for (let i = 0; i < 128; i++) {
    embedding.push(Math.random());
  }
  return embedding;
}

// 🔍 Funkcja porównująca wektory twarzy
function calculateSimilarity(embedding1, embedding2) {
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    magnitude1 += embedding1[i] * embedding1[i];
    magnitude2 += embedding2[i] * embedding2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  return dotProduct / (magnitude1 * magnitude2);
}

// 📍 ENDPOINT 1: Rejestracja twarzy

app.post('/api/register', upload.single('photo'), async (req, res) => {
  try {
    const { firstName, lastName, pesel, dateOfBirth, gender } = req.body;
    
    if (!firstName || !lastName || !pesel || !dateOfBirth || !gender || !req.file) {
      return res.status(400).json({
        Sukces: false,
        Wiadomosc: 'Brakuje wymaganych danych!'
      });
    }

    const existing = await getAsync('SELECT pesel FROM faces WHERE pesel = ?', [pesel]);
    if (existing) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        Sukces: false,
        Wiadomosc: 'Osoba z tym PESELem już istnieje!'
      });
    }

    const embedding = generateMockEmbedding();
    const embeddingJson = JSON.stringify(embedding);
    const photoPath = `/uploads/${req.file.filename}`;

    await runAsync(
      `INSERT INTO faces (pesel, first_name, last_name, date_of_birth, gender, embedding, photo_path) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [pesel, firstName, lastName, dateOfBirth, gender, embeddingJson, photoPath]
    );

    console.log(`✅ Zarejestrowano: ${firstName} ${lastName} (PESEL: ${pesel})`);

    // 🧠 AUTO-TRIGGER: Wyciągnij encoding twarzy za pomocą Python
    try {
      console.log(`🧠 Extracting face encoding via Python...`);
      const pythonResponse = await fetch('http://localhost:5001/api/register-face-encoding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pesel: pesel, 
          photo_path: photoPath 
        }),
        timeout: 120000
      });

      const pythonResult = await pythonResponse.json();
      
      if (pythonResult.Sukces) {
        console.log(`✅ Face encoding registered successfully`);
      } else {
        console.log(`⚠️ Face encoding failed: ${pythonResult.Wiadomosc}`);
      }
    } catch (pythonError) {
      console.error(`⚠️ Python service error (non-critical):`, pythonError.message);
      // Nie blokujemy rejestracji jeśli Python zawali
    }

    res.json({
      Sukces: true,
      Wiadomosc: `Pomyślnie zarejestrowano: ${firstName} ${lastName}`,
      Osoba: {
        Pesel: pesel,
        Imie: firstName,
        Nazwisko: lastName,
        DataUrodzenia: dateOfBirth,
        Plec: gender,
        SciezkaZdjecia: photoPath,
        DataRejestracji: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Błąd rejestracji:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// 📍 ENDPOINT 3: Rozpoznawanie twarzy
app.post('/api/recognize', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        Rozpoznano: false,
        Wiadomosc: 'Brak zdjęcia!'
      });
    }

    const photoPath = `/uploads/${req.file.filename}`;
    
    // Wyślij do Python serwera
    try {
      const pythonResponse = await fetch('http://localhost:5001/api/recognize-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_path: photoPath }),
        timeout: 120000  // 120 sekund (zamiast 30)
      });

      const result = await pythonResponse.json();
      
      // Usuń plik tymczasowy
      fs.unlinkSync(req.file.path);
      
      // Zapisz do historii jeśli rozpoznano
      if (result.Rozpoznano) {
        await runAsync(
          'INSERT INTO search_history (pesel, first_name, last_name, search_type, found) VALUES (?, ?, ?, ?, ?)',
          [result.Pesel, result.Imie, result.Nazwisko, 'mobile', 1]
        );
      } else {
        await runAsync(
          'INSERT INTO search_history (pesel, search_type, found) VALUES (?, ?, ?)',
          ['unknown', 'mobile', 0]
        );
      }
      
      return res.json(result);
    } catch (pythonError) {
      console.error('❌ Python service error:', pythonError);
      
      // Fallback - użyj starego systemu
      const newEmbedding = generateMockEmbedding();
      const faces = await allAsync('SELECT * FROM faces');

      if (faces.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.json({
          Rozpoznano: false,
          Wiadomosc: 'Brak zarejestrowanych twarzy!'
        });
      }

      let bestMatch = null;
      let highestSimilarity = 0;
      const THRESHOLD = 0.6;

      faces.forEach(face => {
        const storedEmbedding = JSON.parse(face.embedding);
        const similarity = calculateSimilarity(newEmbedding, storedEmbedding);

        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          bestMatch = face;
        }
      });

      fs.unlinkSync(req.file.path);

      if (bestMatch && highestSimilarity > THRESHOLD) {
        console.log(`🔍 Rozpoznano twarz: ${bestMatch.first_name} ${bestMatch.last_name}`);
        res.json({
          Rozpoznano: true,
          Pesel: bestMatch.pesel,
          Imie: bestMatch.first_name,
          Nazwisko: bestMatch.last_name,
          DataUrodzenia: bestMatch.date_of_birth,
          Plec: bestMatch.gender,
          Pewnosc: highestSimilarity,
          Wiadomosc: `Rozpoznano: ${bestMatch.first_name} ${bestMatch.last_name}`
        });
      } else {
        res.json({
          Rozpoznano: false,
          Pesel: null,
          Imie: null,
          Nazwisko: null,
          Pewnosc: highestSimilarity,
          Wiadomosc: 'Twarz nie została rozpoznana'
        });
      }
    }
  } catch (error) {
    console.error('❌ Błąd rozpoznawania:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      Rozpoznano: false,
      Wiadomosc: error.message
    });
  }
});

// 📍 ENDPOINT 5: Lista osób
app.get('/api/faces', async (req, res) => {
  try {
    const faces = await allAsync(`
      SELECT pesel, first_name, last_name, date_of_birth, gender, photo_path, created_at 
      FROM faces
    `);
    
    const formatted = faces.map(face => ({
      Pesel: face.pesel,
      Imie: face.first_name,
      Nazwisko: face.last_name,
      DataUrodzenia: face.date_of_birth,
      Plec: face.gender,
      SciezkaZdjecia: face.photo_path,
      DataRejestracji: face.created_at
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📍 ENDPOINT 6: Szczegóły osoby
app.get('/api/faces/:pesel', async (req, res) => {
  try {
    const { pesel } = req.params;
    const face = await getAsync(`
      SELECT pesel, first_name, last_name, date_of_birth, gender, photo_path, created_at 
      FROM faces WHERE pesel = ?
    `, [pesel]);
    
    if (!face) {
      return res.status(404).json({
        Sukces: false,
        Wiadomosc: 'Osoba nie znaleziona'
      });
    }

    // Zapisz do historii wyszukiwania
    await runAsync(
      'INSERT INTO search_history (pesel, first_name, last_name, search_type, found) VALUES (?, ?, ?, ?, ?)',
      [pesel, face.first_name, face.last_name, 'web', 1]
    );

    res.json({
      Sukces: true,
      Osoba: {
        Pesel: face.pesel,
        Imie: face.first_name,
        Nazwisko: face.last_name,
        DataUrodzenia: face.date_of_birth,
        Plec: face.gender,
        SciezkaZdjecia: face.photo_path,
        DataRejestracji: face.created_at,
      }
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// 📍 ENDPOINT 7: Usuń osobę
app.delete('/api/faces/:pesel', async (req, res) => {
  try {
    const { pesel } = req.params;
    const face = await getAsync('SELECT photo_path FROM faces WHERE pesel = ?', [pesel]);
    
    if (!face) {
      return res.status(404).json({
        Sukces: false,
        Wiadomosc: 'Nie znaleziono'
      });
    }

    const filePath = path.join(__dirname, face.photo_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await runAsync('DELETE FROM faces WHERE pesel = ?', [pesel]);
    console.log(`🗑️ Usunięto osobę PESEL: ${pesel}`);

    res.json({
      Sukces: true,
      Wiadomosc: 'Usunięto'
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// 📍 ENDPOINT 8: Historia wyszukiwania
app.get('/api/search-history', async (req, res) => {
  try {
    const history = await allAsync(`
      SELECT id, pesel, first_name, last_name, search_type, found, searched_at 
      FROM search_history 
      ORDER BY searched_at DESC 
      LIMIT 100
    `);

    const formatted = history.map(entry => ({
      Id: entry.id,
      Pesel: entry.pesel,
      Imie: entry.first_name,
      Nazwisko: entry.last_name,
      TypWyszukiwania: entry.search_type,
      Znaleziono: entry.found === 1,
      DataWyszukiwania: entry.searched_at
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📍 ENDPOINT 9: Wyczyść historię
app.delete('/api/search-history', async (req, res) => {
  try {
    await runAsync('DELETE FROM search_history');
    res.json({
      Sukces: true,
      Wiadomosc: 'Historia wyszukiwania wyczyszczona'
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// 🏠 Strona główna - API info
app.get('/api', (req, res) => {
  res.json({
    name: '🎭 Face & Fingerprint Recognition API',
    version: '1.0.0',
    endpoints: {
      register: 'POST /api/register',
      registerFingerprint: 'POST /api/register-fingerprint',
      recognize: 'POST /api/recognize',
      recognizeFingerprint: 'POST /api/recognize-fingerprint',
      listFaces: 'GET /api/faces',
      getFaceDetails: 'GET /api/faces/:pesel',
      deleteFace: 'DELETE /api/faces/:pesel',
      searchHistory: 'GET /api/search-history',
      clearHistory: 'DELETE /api/search-history'
    }
  });
});
// ============================================================
// 📍 ENDPOINT 10: Pobierz status NFC i bezpieczeństwa
// ============================================================

app.get('/api/nfc/status/:pesel', async (req, res) => {
  try {
    const { pesel } = req.params;

    const nfc = await getAsync(`
      SELECT nfc_uid, nfc_active FROM nfc_tags WHERE pesel = ?
    `, [pesel]);

    const security = await getAsync(`
      SELECT is_wanted, is_blocked, reason, alert_color FROM security_status WHERE pesel = ?
    `, [pesel]);

    res.json({
      Sukces: true,
      NFC: nfc ? {
        Zarejestrowany: true,
        NfcUid: nfc.nfc_uid,
        Aktywny: nfc.nfc_active === 1
      } : {
        Zarejestrowany: false,
        Aktywny: true,
        NfcUid: null
      },
      Security: security ? {
        Poszukiwany: security.is_wanted === 1,
        Zastrzeżony: security.is_blocked === 1,
        Powód: security.reason || '',
        KolorAlertu: security.alert_color
      } : {
        Poszukiwany: false,
        Zastrzeżony: false,
        Powód: '',
        KolorAlertu: 'green'
      }
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// ============================================================
// 📍 ENDPOINT 11: Włącz/Wyłącz NFC
// ============================================================

app.put('/api/nfc/toggle/:pesel', async (req, res) => {
  try {
    const { pesel } = req.params;
    const { active } = req.body;

    const nfc = await getAsync('SELECT nfc_active FROM nfc_tags WHERE pesel = ?', [pesel]);
    if (!nfc) {
      return res.status(404).json({
        Sukces: false,
        Wiadomosc: 'NFC nie zarejestrowany dla tej osoby'
      });
    }

    await runAsync(
      'UPDATE nfc_tags SET nfc_active = ? WHERE pesel = ?',
      [active ? 1 : 0, pesel]
    );

    const status = active ? 'włączony' : 'wyłączony';
    console.log(`🔐 NFC ${status} dla PESEL: ${pesel}`);

    res.json({
      Sukces: true,
      Wiadomosc: `NFC ${status}`,
      Aktywny: active
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// ============================================================
// 📍 ENDPOINT 12: Ustaw status bezpieczeństwa
// ============================================================

app.put('/api/security/status/:pesel', async (req, res) => {
  try {
    const { pesel } = req.params;
    const { is_wanted, is_blocked, reason, alert_color } = req.body;

    const person = await getAsync('SELECT pesel FROM faces WHERE pesel = ?', [pesel]);
    if (!person) {
      return res.status(404).json({
        Sukces: false,
        Wiadomosc: 'Osoba nie istnieje'
      });
    }

    const color = alert_color || (is_wanted ? 'red' : is_blocked ? 'orange' : 'green');

    const existing = await getAsync('SELECT id FROM security_status WHERE pesel = ?', [pesel]);
    
    if (existing) {
      await runAsync(`
        UPDATE security_status 
        SET is_wanted = ?, is_blocked = ?, reason = ?, alert_color = ?, updated_at = datetime('now')
        WHERE pesel = ?
      `, [is_wanted ? 1 : 0, is_blocked ? 1 : 0, reason || null, color, pesel]);
    } else {
      await runAsync(`
        INSERT INTO security_status (pesel, is_wanted, is_blocked, reason, alert_color, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [pesel, is_wanted ? 1 : 0, is_blocked ? 1 : 0, reason || null, color]);
    }

    await runAsync(`
      INSERT INTO security_events (pesel, event_type, alert_color, detection_method)
      VALUES (?, ?, ?, ?)
    `, [pesel, is_wanted ? 'WANTED' : is_blocked ? 'BLOCKED' : 'CLEARED', color, 'admin']);

    console.log(`🚨 Status bezpieczeństwa zmieniony dla ${pesel}`);

    res.json({
      Sukces: true,
      Wiadomosc: 'Status bezpieczeństwa zaktualizowany',
      Status: {
        Poszukiwany: is_wanted,
        Zastrzeżony: is_blocked,
        Powód: reason,
        KolorAlertu: color
      }
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// ============================================================
// 📍 ENDPOINT 13: Pobierz informacje bezpieczeństwa
// ============================================================

app.get('/api/security/status/:pesel', async (req, res) => {
  try {
    const { pesel } = req.params;

    const security = await getAsync(`
      SELECT is_wanted, is_blocked, reason, alert_color FROM security_status WHERE pesel = ?
    `, [pesel]);

    res.json({
      Sukces: true,
      Status: security ? {
        Poszukiwany: security.is_wanted === 1,
        Zastrzeżony: security.is_blocked === 1,
        Powód: security.reason || '',
        KolorAlertu: security.alert_color
      } : {
        Poszukiwany: false,
        Zastrzeżony: false,
        Powód: '',
        KolorAlertu: 'green'
      }
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// ============================================================
// 📍 ENDPOINT 14: Historia zdarzeń bezpieczeństwa
// ============================================================

app.get('/api/security/events', async (req, res) => {
  try {
    const events = await allAsync(`
      SELECT id, pesel, event_type, alert_color, detection_method, event_at
      FROM security_events
      ORDER BY event_at DESC
      LIMIT 100
    `);

    const formatted = events.map(event => ({
      Id: event.id,
      Pesel: event.pesel,
      TypZdarzenia: event.event_type,
      KolorAlertu: event.alert_color,
      MetodaDetekcji: event.detection_method,
      DataZdarzenia: event.event_at
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// ============================================================
// 📍 ENDPOINT 15: Pobierz wszystkie osoby z statusami
// ============================================================
app.get('/api/faces-with-security', async (req, res) => {
  try {
    const faces = await allAsync(`
      SELECT 
        f.pesel, f.first_name, f.last_name, f.date_of_birth, f.gender, f.photo_path,
        COALESCE(n.nfc_uid, '') as nfc_uid,
        COALESCE(n.nfc_active, 0) as nfc_active,
        COALESCE(s.is_wanted, 0) as is_wanted,
        COALESCE(s.is_blocked, 0) as is_blocked,
        COALESCE(s.reason, '') as reason,
        COALESCE(s.alert_color, 'green') as alert_color
      FROM faces f
      LEFT JOIN nfc_tags n ON f.pesel = n.pesel
      LEFT JOIN security_status s ON f.pesel = s.pesel
    `);

    const formatted = faces.map(face => ({
      Pesel: face.pesel,
      Imie: face.first_name,
      Nazwisko: face.last_name,
      DataUrodzenia: face.date_of_birth,
      Plec: face.gender,
      SciezkaZdjecia: face.photo_path,
      NFC: {
        Zarejestrowany: face.nfc_uid ? true : false,
        Aktywny: face.nfc_active === 1,
        NfcUid: face.nfc_uid || null
      },
      Security: {
        Poszukiwany: face.is_wanted === 1,
        Zastrzeżony: face.is_blocked === 1,
        Powód: face.reason,
        KolorAlertu: face.alert_color
      }
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// ============================================================
// 📍 ENDPOINT 16: Zmień status NFC (włącz/wyłącz)
// ============================================================

app.post('/api/nfc/toggle-status', async (req, res) => {
  try {
    const { pesel, active } = req.body;

    if (!pesel) {
      return res.status(400).json({
        Sukces: false,
        Wiadomosc: 'Brakuje PESELu'
      });
    }

    const updated = await runAsync(
      'UPDATE nfc_tags SET nfc_active = ? WHERE pesel = ?',
      [active ? 1 : 0, pesel]
    );

    if (updated.changes === 0) {
      return res.status(404).json({
        Sukces: false,
        Wiadomosc: 'NFC nie znaleziony'
      });
    }

    console.log(`🔄 NFC zmieniony na ${active ? 'AKTYWNY' : 'NIEAKTYWNY'} dla ${pesel}`);

    res.json({
      Sukces: true,
      Wiadomosc: `NFC ${active ? 'włączony' : 'wyłączony'}`,
      Status: {
        Pesel: pesel,
        Aktywny: active
      }
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// ============================================================
// 📍 ENDPOINT 17: Zastrzeż/Odblokuj osobę (uproszczony)
// ============================================================

app.post('/api/security/block/:pesel', async (req, res) => {
  try {
    const { pesel } = req.params;
    const { blocked, reason } = req.body;

    const person = await getAsync('SELECT first_name, last_name FROM faces WHERE pesel = ?', [pesel]);
    if (!person) {
      return res.status(404).json({
        Sukces: false,
        Wiadomosc: 'Osoba nie istnieje'
      });
    }

    const existing = await getAsync('SELECT id FROM security_status WHERE pesel = ?', [pesel]);
    
    if (existing) {
      await runAsync(`
        UPDATE security_status 
        SET is_blocked = ?, reason = ?, alert_color = ?, updated_at = datetime('now')
        WHERE pesel = ?
      `, [blocked ? 1 : 0, reason || null, blocked ? 'orange' : 'green', pesel]);
    } else {
      await runAsync(`
        INSERT INTO security_status (pesel, is_wanted, is_blocked, reason, alert_color, created_at, updated_at)
        VALUES (?, 0, ?, ?, ?, datetime('now'), datetime('now'))
      `, [pesel, blocked ? 1 : 0, reason || null, blocked ? 'orange' : 'green']);
    }

    await runAsync(`
      INSERT INTO security_events (pesel, event_type, alert_color, detection_method)
      VALUES (?, ?, ?, ?)
    `, [pesel, blocked ? 'BLOCKED' : 'UNBLOCKED', blocked ? 'orange' : 'green', 'admin']);

    console.log(`🚨 ${blocked ? 'Zastrzeżono' : 'Odblokowano'} osobę: ${person.first_name} ${person.last_name}`);

    res.json({
      Sukces: true,
      Wiadomosc: `${blocked ? 'Zastrzeżono' : 'Odblokowano'} osobę: ${person.first_name} ${person.last_name}`,
      Status: {
        Pesel: pesel,
        Zastrzeżony: blocked,
        Powód: reason || ''
      }
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// ============================================================
// 📍 ENDPOINT 18: Oznacz jako poszukiwany
// ============================================================

app.post('/api/security/wanted/:pesel', async (req, res) => {
  try {
    const { pesel } = req.params;
    const { wanted, reason } = req.body;

    const person = await getAsync('SELECT first_name, last_name FROM faces WHERE pesel = ?', [pesel]);
    if (!person) {
      return res.status(404).json({
        Sukces: false,
        Wiadomosc: 'Osoba nie istnieje'
      });
    }

    const existing = await getAsync('SELECT id FROM security_status WHERE pesel = ?', [pesel]);
    
    if (existing) {
      await runAsync(`
        UPDATE security_status 
        SET is_wanted = ?, reason = ?, alert_color = ?, updated_at = datetime('now')
        WHERE pesel = ?
      `, [wanted ? 1 : 0, reason || null, wanted ? 'red' : 'green', pesel]);
    } else {
      await runAsync(`
        INSERT INTO security_status (pesel, is_wanted, is_blocked, reason, alert_color, created_at, updated_at)
        VALUES (?, ?, 0, ?, ?, datetime('now'), datetime('now'))
      `, [pesel, wanted ? 1 : 0, reason || null, wanted ? 'red' : 'green']);
    }

    await runAsync(`
      INSERT INTO security_events (pesel, event_type, alert_color, detection_method)
      VALUES (?, ?, ?, ?)
    `, [pesel, wanted ? 'WANTED' : 'CLEARED', wanted ? 'red' : 'green', 'admin']);

    console.log(`🚨 ${wanted ? 'POSZUKIWANY' : 'WYCZYSZCZONO'}: ${person.first_name} ${person.last_name}`);

    res.json({
      Sukces: true,
      Wiadomosc: `${wanted ? 'Oznaczono jako POSZUKIWANEGO' : 'Usunięto status poszukiwanego'}: ${person.first_name} ${person.last_name}`,
      Status: {
        Pesel: pesel,
        Poszukiwany: wanted,
        Powód: reason || '',
        KolorAlertu: wanted ? 'red' : 'green'
      }
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// ============================================================
// 📍 ENDPOINT 19: Wyczyść wszystkie statusy bezpieczeństwa
// ============================================================

app.delete('/api/security/clear-all', async (req, res) => {
  try {
    await runAsync(`
      UPDATE security_status 
      SET is_wanted = 0, is_blocked = 0, reason = NULL, alert_color = 'green', updated_at = datetime('now')
    `);

    await runAsync(`
      INSERT INTO security_events (pesel, event_type, alert_color, detection_method)
      SELECT pesel, 'CLEARED_ALL', 'green', 'admin' FROM security_status
    `);

    console.log('🧹 Wyczyszczono wszystkie statusy bezpieczeństwa');

    res.json({
      Sukces: true,
      Wiadomosc: 'Wszystkie statusy bezpieczeństwa wyczyszczone'
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// ============================================================
// 📍 ENDPOINT 20: Statystyki bezpieczeństwa
// ============================================================

app.get('/api/security/stats', async (req, res) => {
  try {
    const total = await getAsync('SELECT COUNT(*) as count FROM faces');
    const wanted = await getAsync('SELECT COUNT(*) as count FROM security_status WHERE is_wanted = 1');
    const blocked = await getAsync('SELECT COUNT(*) as count FROM security_status WHERE is_blocked = 1');
    const clear = await getAsync('SELECT COUNT(*) as count FROM security_status WHERE is_wanted = 0 AND is_blocked = 0');
    const nfcActive = await getAsync('SELECT COUNT(*) as count FROM nfc_tags WHERE nfc_active = 1');
    const nfcInactive = await getAsync('SELECT COUNT(*) as count FROM nfc_tags WHERE nfc_active = 0');

    res.json({
      Sukces: true,
      Statystyki: {
        CałkowiteOsoby: total?.count || 0,
        Poszukiwani: wanted?.count || 0,
        Zastrzeżeni: blocked?.count || 0,
        BezZagrożenia: clear?.count || 0,
        NfcAktywne: nfcActive?.count || 0,
        NfcNieaktywne: nfcInactive?.count || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// ============================================================
// 📍 ENDPOINT 21: API Info
// ============================================================

app.get('/api', (req, res) => {
  res.json({
    name: '🎭 Face & Fingerprint Recognition API + NFC Security',
    version: '2.0.0',
    endpoints: {
      faces: {
        register: 'POST /api/register',
        list: 'GET /api/faces',
        details: 'GET /api/faces/:pesel',
        delete: 'DELETE /api/faces/:pesel',
        withSecurity: 'GET /api/faces-with-security'
      },
      fingerprint: {
        register: 'POST /api/register-fingerprint'
      },
      recognition: {
        recognize: 'POST /api/recognize'
      },
      nfc: {
        register: 'POST /api/nfc/register',
        status: 'GET /api/nfc/status/:pesel',
        toggle: 'PUT /api/nfc/toggle/:pesel',
        toggleStatus: 'POST /api/nfc/toggle-status'
      },
      security: {
        setStatus: 'PUT /api/security/status/:pesel',
        getStatus: 'GET /api/security/status/:pesel',
        block: 'POST /api/security/block/:pesel',
        wanted: 'POST /api/security/wanted/:pesel',
        events: 'GET /api/security/events',
        stats: 'GET /api/security/stats',
        clearAll: 'DELETE /api/security/clear-all'
      },
      history: {
        searchHistory: 'GET /api/search-history',
        clearHistory: 'DELETE /api/search-history'
      }
    }
  });
});
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('📝 Login attempt - Body:', req.body);

    if (!username || !password) {
      return res.status(400).json({
        Sukces: false,
        Wiadomosc: 'Brak nazwy użytkownika lub hasła'
      });
    }

    const user = await getAsync(
      'SELECT id, username, password_hash, role, first_name, last_name FROM users WHERE username = ?',
      [username]
    );

    if (!user) {
      return res.status(401).json({
        Sukces: false,
        Wiadomosc: 'Nieprawidłowa nazwa użytkownika lub hasło'
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        Sukces: false,
        Wiadomosc: 'Nieprawidłowa nazwa użytkownika lub hasło'
      });
    }

    // Aktualizuj ostatnie logowanie
    await runAsync(
      'UPDATE users SET last_login = datetime("now") WHERE id = ?',
      [user.id]
    );

    // Wygeneruj token JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username,
        firstName: user.first_name,   
        lastName: user.last_name,      
        role: user.role 
      },
      SECRET_KEY,
      { expiresIn: '24h' }
    );

    // Zaloguj aktywność
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    await logActivity('LOGIN', null, fullName || username, `Użytkownik ${username} zalogował się`, 'system');

    console.log(`✅ Zalogowano: ${fullName || username}`);

    res.json({
      Sukces: true,
      Token: token,
      Uzytkownik: {
        Id: user.id,
        Username: user.username,
        FirstName: user.first_name,    
        LastName: user.last_name,       
        FullName: `${user.first_name} ${user.last_name}`, 
        Rola: user.role
      },
      Wiadomosc: 'Zalogowano pomyślnie'
    });

  } catch (error) {
    console.error('Błąd logowania:', error);
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// ════════════════════════════════════════════════════════════════

// 3. ZMIANA ENDPOINT REGISTER-USER - DODAJ IMIĘ I NAZWISKO

app.post('/api/register-user', verifyToken, async (req, res) => {
  try {
    // Sprawdź czy użytkownik jest adminem
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        Sukces: false,
        Wiadomosc: 'Brak uprawnień'
      });
    }

    const { username, password, firstName, lastName, role } = req.body; 

    if (!username || !password || !firstName || !lastName) {
      return res.status(400).json({
        Sukces: false,
        Wiadomosc: 'Wymagane: username, password, firstName, lastName'
      });
    }

    // Sprawdź czy użytkownik już istnieje
    const existing = await getAsync(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existing) {
      return res.status(400).json({
        Sukces: false,
        Wiadomosc: 'Użytkownik już istnieje'
      });
    }

    // Hashuj hasło
    const passwordHash = await bcrypt.hash(password, 10);

    // Dodaj użytkownika
    await runAsync(
      'INSERT INTO users (username, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)',
      [username, passwordHash, firstName, lastName, role || 'operator']
    );

    const fullName = `${firstName} ${lastName}`;
    await logActivity('REGISTER_USER', null, fullName, `Utworzono użytkownika ${username}`, req.user.username);

    res.json({
      Sukces: true,
      Wiadomosc: `Użytkownik ${fullName} (${username}) utworzony`
    });

  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// GET /api/verify-token - Weryfikacja tokenu

app.get('/api/verify-token', verifyToken, (req, res) => {
  res.json({
    Sukces: true,
    Uzytkownik: {
      Id: req.user.id,
      Username: req.user.username,
      Rola: req.user.role
    }
  });
});


// ============================================================
// 📍 ENDPOINT: Raporty - NAPRAWIONA WERSJA (szuka camelCase)
// ============================================================

app.post('/api/reports/save', async (req, res) => {
  try {
    const raport = req.body;
    const pesel = raport.pesel || raport.Pesel;
    
    if (!pesel) {
      return res.status(400).json({
        Sukces: false,
        Wiadomosc: 'Brakuje PESELu'
      });
    }

    const raportId = raport.id || uuidv4();

    // Jeśli przychodzi operator z JWT, pobierz pełne imię
    let operatorFullName = raport.operator || raport.Operator;
    if (req.headers['authorization']) {
      try {
        const token = req.headers['authorization'].split(' ')[1];
        const decoded = jwt.verify(token, SECRET_KEY);
        operatorFullName = `${decoded.firstName} ${decoded.lastName}`.trim();
      } catch (err) {
        // Jeśli token invalid, użyj defaultu
      }
    }

    await runAsync(`
      INSERT INTO raporty (
        id, pesel, imie, nazwisko, data_urodzenia, plec, pewnosc,
        notatka, przeprowadzone_dzialania, czy_mandat, kwota_mandatu,
        numer_mandatu, typ_mandatu, status_mandatu, operator,
        data_wysylania, status, pełne_imie, dane_podstawowe, dane_mandatu
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      raportId,
      pesel,
      raport.imie || raport.Imie || '',
      raport.nazwisko || raport.Nazwisko || '',
      raport.dataUrodzenia || raport.DataUrodzenia || null,
      raport.plec || raport.Plec || '',
      raport.pewnosc || raport.Pewnosc || 0,
      raport.notatka || raport.Notatka || '',
      raport.przeprowadzoneDialania || raport.PrzeprowadzoneDialania || '',
      raport.czyMandat || raport.CzyMandat ? 1 : 0,
      raport.kwotaMandatu || raport.KwotaMandatu || null,
      raport.numerMandata || raport.NumerMandata || '',
      raport.typMandata || raport.TypMandata || '',
      raport.statusMandata || raport.StatusMandata || '',
      operatorFullName,                
      raport.dataWyslania || raport.DataWyslania || null,
      'Nowy',
      raport.pelneImie || raport.PelneImie || '',
      raport.danePodstawowe || raport.DanePodstawowe || '',
      raport.daneMandata || raport.DaneMandata || ''
    ]);

    console.log(`✅ Raport zapisany przez: ${operatorFullName}`);

    res.json({
      Sukces: true,
      Wiadomosc: 'Raport zapisany do bazy danych',
      RaportId: raportId,
      Raport: raport
    });
  } catch (error) {
    console.log("❌ Błąd w /api/reports/save: ", error);
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// ✅ POST - Wyślij raport (zmień status)
app.post('/api/reports/submit', async (req, res) => {
  try {
    const raport = req.body;
    
    console.log("📥 POST /api/reports/submit - Otrzymany body:");
    console.log("   PESEL: ", raport.pesel || raport.Pesel);

    const pesel = raport.pesel || raport.Pesel;
    const raportId = raport.id || uuidv4();
    
    if (!pesel) {
      console.log("❌ PESEL nie znaleziony!");
      return res.status(400).json({
        Sukces: false,
        Wiadomosc: 'Brakuje PESELu'
      });
    }

    // Sprawdź czy raport już istnieje
    const existing = await getAsync('SELECT id FROM raporty WHERE id = ?', [raportId]);
    
    if (existing) {
      // Update istniejącego raportu
      await runAsync(`
        UPDATE raporty 
        SET status = ?, data_wysylania = datetime('now')
        WHERE id = ?
      `, ['Wysłany', raportId]);
      console.log(`📤 Raport wysłany (update): ${raport.imie || raport.Imie}`);
    } else {
      // Wstaw nowy raport
      await runAsync(`
        INSERT INTO raporty (
          id, pesel, imie, nazwisko, data_urodzenia, plec, pewnosc,
          notatka, przeprowadzone_dzialania, czy_mandat, kwota_mandatu,
          numer_mandatu, typ_mandatu, status_mandatu, operator,
          status, pełne_imie, dane_podstawowe, dane_mandatu
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        raportId,
        pesel,
        raport.imie || raport.Imie || '',
        raport.nazwisko || raport.Nazwisko || '',
        raport.dataUrodzenia || raport.DataUrodzenia || null,
        raport.plec || raport.Plec || '',
        raport.pewnosc || raport.Pewnosc || 0,
        raport.notatka || raport.Notatka || '',
        raport.przeprowadzoneDialania || raport.PrzeprowadzoneDialania || '',
        raport.czyMandat || raport.CzyMandat ? 1 : 0,
        raport.kwotaMandatu || raport.KwotaMandatu || null,
        raport.numerMandata || raport.NumerMandata || '',
        raport.typMandata || raport.TypMandata || '',
        raport.statusMandata || raport.StatusMandata || '',
        raport.operator || raport.Operator || null,
        'Wysłany',
        raport.pelneImie || raport.PelneImie || '',
        raport.danePodstawowe || raport.DanePodstawowe || '',
        raport.daneMandata || raport.DaneMandata || ''
      ]);
      console.log(`📤 Raport wysłany (insert): ${raport.imie || raport.Imie}`);
    }

    // Zaloguj aktywność
    if (raport.czyMandat || raport.CzyMandat) {
      await logActivity('REPORT_WITH_FINE', pesel, 
        `${raport.imie || raport.Imie} ${raport.nazwisko || raport.Nazwisko}`, 
        `Mandat: ${raport.kwotaMandatu || raport.KwotaMandatu} PLN`);
    } else {
      await logActivity('REPORT_SUBMITTED', pesel, 
        `${raport.imie || raport.Imie} ${raport.nazwisko || raport.Nazwisko}`, 
        `Typ: ${(raport.przeprowadzoneDialania || raport.PrzeprowadzoneDialania || '').substring(0, 50)}`);
    }

    res.json({
      Sukces: true,
      Wiadomosc: 'Raport wysłany do systemu',
      RaportId: raportId,
      Raport: raport
    });
  } catch (error) {
    console.log("❌ Błąd w /api/reports/submit: ", error);
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// ✅ GET - Pobierz wszystkie raporty
app.get('/api/reports', async (req, res) => {
  try {
    const raporty = await allAsync(`
      SELECT * FROM raporty ORDER BY data_raportu DESC
    `);

    const formatted = raporty.map(r => ({
      id: r.id,
      pesel: r.pesel,
      imie: r.imie,
      nazwisko: r.nazwisko,
      dataUrodzenia: r.data_urodzenia,
      plec: r.plec,
      pewnosc: r.pewnosc,
      notatka: r.notatka,
      przeprowadzoneDialania: r.przeprowadzone_dzialania,
      czyMandat: r.czy_mandat === 1,
      kwotaMandatu: r.kwota_mandatu,
      numerMandata: r.numer_mandatu,
      typMandata: r.typ_mandatu,
      statusMandata: r.status_mandatu,
      operator: r.operator,
      dataWyslania: r.data_wysylania,
      status: r.status,
      pelneImie: r.pełne_imie,
      danePodstawowe: r.dane_podstawowe,
      daneMandata: r.dane_mandatu,
      dataRaportu: r.data_raportu
    }));

    res.json({
      Sukces: true,
      Raporty: formatted,
      Ilosc: formatted.length,
      ZMandatem: formatted.filter(r => r.czyMandat).length,
      BezMandatu: formatted.filter(r => !r.czyMandat).length,
      Wysłane: formatted.filter(r => r.status === 'Wysłany').length
    });
  } catch (error) {
    console.error('❌ Błąd w GET /api/reports:', error);
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// ✅ GET - Pobierz raporty dla konkretnej osoby
app.get('/api/reports/person/:pesel', async (req, res) => {
  try {
    const { pesel } = req.params;
    
    const raporty = await allAsync(`
      SELECT * FROM raporty WHERE pesel = ? ORDER BY data_raportu DESC
    `, [pesel]);

    if (raporty.length === 0) {
      return res.json({
        Sukces: false,
        Wiadomosc: 'Brak raportów dla tej osoby'
      });
    }

    const formatted = raporty.map(r => ({
      id: r.id,
      pesel: r.pesel,
      imie: r.imie,
      nazwisko: r.nazwisko,
      dataUrodzenia: r.data_urodzenia,
      plec: r.plec,
      pewnosc: r.pewnosc,
      notatka: r.notatka,
      przeprowadzoneDialania: r.przeprowadzone_dzialania,
      czyMandat: r.czy_mandat === 1,
      kwotaMandatu: r.kwota_mandatu,
      numerMandata: r.numer_mandatu,
      typMandata: r.typ_mandatu,
      statusMandata: r.status_mandatu,
      operator: r.operator,
      dataWyslania: r.data_wysylania,
      status: r.status,
      pelneImie: r.pełne_imie,
      danePodstawowe: r.dane_podstawowe,
      daneMandata: r.dane_mandatu,
      dataRaportu: r.data_raportu
    }));

    res.json({
      Sukces: true,
      Raporty: formatted,
      Ilosc: formatted.length
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// ✅ GET - Pobierz raport po ID
app.get('/api/reports/:raportId', async (req, res) => {
  try {
    const { raportId } = req.params;
    
    const raport = await getAsync(`
      SELECT * FROM raporty WHERE id = ?
    `, [raportId]);

    if (!raport) {
      return res.status(404).json({
        Sukces: false,
        Wiadomosc: 'Raport nie znaleziony'
      });
    }

    res.json({
      Sukces: true,
      Raport: {
        id: raport.id,
        pesel: raport.pesel,
        imie: raport.imie,
        nazwisko: raport.nazwisko,
        dataUrodzenia: raport.data_urodzenia,
        plec: raport.plec,
        pewnosc: raport.pewnosc,
        notatka: raport.notatka,
        przeprowadzoneDialania: raport.przeprowadzone_dzialania,
        czyMandat: raport.czy_mandat === 1,
        kwotaMandatu: raport.kwota_mandatu,
        numerMandata: raport.numer_mandatu,
        typMandata: raport.typ_mandatu,
        statusMandata: raport.status_mandatu,
        operator: raport.operator,
        dataWyslania: raport.data_wysylania,
        status: raport.status,
        pelneImie: raport.pełne_imie,
        danePodstawowe: raport.dane_podstawowe,
        daneMandata: raport.dane_mandatu,
        dataRaportu: raport.data_raportu
      }
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// ✅ DELETE - Usuń raport
app.delete('/api/reports/:raportId', async (req, res) => {
  try {
    const { raportId } = req.params;
    
    const result = await runAsync(`
      DELETE FROM raporty WHERE id = ?
    `, [raportId]);

    if (result.changes === 0) {
      return res.status(404).json({
        Sukces: false,
        Wiadomosc: 'Raport nie znaleziony'
      });
    }

    console.log(`🗑️ Raport usunięty: ${raportId}`);

    res.json({
      Sukces: true,
      Wiadomosc: 'Raport usunięty z bazy danych'
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// ✅ POPRAWIONY ENDPOINT /api/fines - Z OPERATOREM
app.get('/api/fines', async (req, res) => {
  try {
    const fines = await allAsync(`
      SELECT * FROM raporty
      ORDER BY data_raportu DESC
    `);

    const formatted = fines.map(f => {
      // Parsuj operatora aby wyciągnąć imię i nazwisko
      let operatorImie = '';
      let operatorNazwisko = '';
      
      if (f.operator) {
        const parts = f.operator.split(' ');
        operatorImie = parts[0] || '';
        operatorNazwisko = parts.slice(1).join(' ') || '';
      }
      
      return {
        Id: f.id,
        Pesel: f.pesel,
        Imie: f.imie,
        Nazwisko: f.nazwisko,
        DataUrodzenia: f.data_urodzenia,
        Plec: f.plec,
        Pewnosc: f.pewnosc,
        Notatka: f.notatka,
        CzyMandat: f.czy_mandat,
        KwotaMandatu: f.kwota_mandatu,
        NumerMandata: f.numer_mandatu,
        TypMandata: f.typ_mandatu,
        StatusMandata: f.status_mandatu,
        Operator: f.operator,
        OperatorImie: operatorImie,        // ← NOWE
        OperatorNazwisko: operatorNazwisko, // ← NOWE
        DataRaportu: f.data_raportu,
        Status: f.status
        
      };
    });

    res.json({
      Sukces: true,
      Raporty: formatted
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// GET - Pobierz mandaty dla konkretnej osoby
app.get('/api/fines/person/:pesel', async (req, res) => {
  try {
    const { pesel } = req.params;
    
    const fines = await allAsync(`
      SELECT id, pesel, imie, nazwisko, kwota_mandatu as kwota, numer_mandatu as numer,
             typ_mandatu as typ, status_mandatu as status, data_raportu as data,
             notatka, operator, data_wysylania
      FROM raporty 
      WHERE czy_mandat = 1 AND pesel = ?
      ORDER BY data_raportu DESC
    `, [pesel]);

    const formatted = fines.map(f => ({
      Id: f.id,
      Pesel: f.pesel,
      Imie: f.imie,
      Nazwisko: f.nazwisko,
      Kwota: f.kwota,
      Numer: f.numer,
      Typ: f.typ,
      Status: f.status,
      Data: f.data,
      DataWyslania: f.data_wysylania,
      Notatka: f.notatka,
      Operator: f.operator
    }));

    res.json({
      Sukces: true,
      Mandaty: formatted,
      Ilosc: formatted.length
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// PUT - Aktualizuj mandat
app.put('/api/fines/:raportId', async (req, res) => {
  try {
    const { raportId } = req.params;
    const { kwota, numer, typ, status, notatka } = req.body;

    const existing = await getAsync('SELECT pesel, imie, nazwisko FROM raporty WHERE id = ?', [raportId]);
    
    if (!existing) {
      return res.status(404).json({
        Sukces: false,
        Wiadomosc: 'Mandat nie znaleziony'
      });
    }

    await runAsync(`
      UPDATE raporty 
      SET kwota_mandatu = ?, numer_mandatu = ?, typ_mandatu = ?, status_mandatu = ?, notatka = ?
      WHERE id = ?
    `, [kwota || null, numer || null, typ || null, status || null, notatka || null, raportId]);

    await logActivity('FINE_UPDATED', existing.pesel, `${existing.imie} ${existing.nazwisko}`, 
      `Mandat ${numer} - Status: ${status}, Kwota: ${kwota} PLN`, 'admin');

    res.json({
      Sukces: true,
      Wiadomosc: 'Mandat zaktualizowany'
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// PUT - Zmień status mandatu
app.put('/api/fines/:raportId/status', async (req, res) => {
  try {
    const { raportId } = req.params;
    const { status } = req.body;

    const existing = await getAsync('SELECT pesel, numer_mandatu, imie, nazwisko FROM raporty WHERE id = ?', [raportId]);
    
    if (!existing) {
      return res.status(404).json({
        Sukces: false,
        Wiadomosc: 'Mandat nie znaleziony'
      });
    }

    await runAsync(`
      UPDATE raporty 
      SET status_mandatu = ?
      WHERE id = ?
    `, [status, raportId]);

    await logActivity('FINE_STATUS_CHANGED', existing.pesel, `${existing.imie} ${existing.nazwisko}`, 
      `Mandat ${existing.numer_mandatu} - Nowy status: ${status}`, 'admin');

    res.json({
      Sukces: true,
      Wiadomosc: `Status mandatu zmieniony na: ${status}`
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// GET - Statystyki mandatów
app.get('/api/fines/stats', async (req, res) => {
  try {
    const total = await getAsync('SELECT COUNT(*) as count FROM raporty WHERE czy_mandat = 1');
    const paid = await getAsync('SELECT COUNT(*) as count FROM raporty WHERE czy_mandat = 1 AND status_mandatu = ?', ['Zapłacony']);
    const unpaid = await getAsync('SELECT COUNT(*) as count FROM raporty WHERE czy_mandat = 1 AND status_mandatu = ?', ['Nie zapłacony']);
    const pending = await getAsync('SELECT COUNT(*) as count FROM raporty WHERE czy_mandat = 1 AND status_mandatu IN (?, ?)', ['Nowy', 'Wysłany']);
    
    const totalAmount = await getAsync('SELECT SUM(kwota_mandatu) as sum FROM raporty WHERE czy_mandat = 1');
    const paidAmount = await getAsync('SELECT SUM(kwota_mandatu) as sum FROM raporty WHERE czy_mandat = 1 AND status_mandatu = ?', ['Zapłacony']);
    const unpaidAmount = await getAsync('SELECT SUM(kwota_mandatu) as sum FROM raporty WHERE czy_mandat = 1 AND status_mandatu = ?', ['Nie zapłacony']);

    res.json({
      Sukces: true,
      Statystyki: {
        Razem: total?.count || 0,
        Zaplacone: paid?.count || 0,
        NieZaplacone: unpaid?.count || 0,
        Oczekujace: pending?.count || 0,
        KwotaRazem: totalAmount?.sum || 0,
        KwotaZaplacona: paidAmount?.sum || 0,
        KwotaNieZaplacona: unpaidAmount?.sum || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

// DELETE - Usuń mandat
app.delete('/api/fines/:raportId', async (req, res) => {
  try {
    const { raportId } = req.params;
    
    const fine = await getAsync('SELECT pesel, numer_mandatu, imie, nazwisko FROM raporty WHERE id = ?', [raportId]);
    
    if (!fine) {
      return res.status(404).json({
        Sukces: false,
        Wiadomosc: 'Mandat nie znaleziony'
      });
    }

    await runAsync(`
      DELETE FROM raporty WHERE id = ?
    `, [raportId]);

    await logActivity('FINE_DELETED', fine.pesel, `${fine.imie} ${fine.nazwisko}`, 
      `Usunięty mandat ${fine.numer_mandatu}`, 'admin');

    res.json({
      Sukces: true,
      Wiadomosc: 'Mandat usunięty'
    });
  } catch (error) {
    res.status(500).json({
      Sukces: false,
      Wiadomosc: error.message
    });
  }
});

const reports = [];
// 🚀 Start serwera
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════╗
║  🎭👆 Face Recognition      ║
║  🚀 Serwer uruchomiony na porcie ${PORT}      ║
║  📍 http://localhost:${PORT}                  ║
║  🌐 http://192.168.88.253:${PORT}            ║
║  💾 SQLite3 baza danych                     ║
║  📊 Historia wyszukiwania włączona          ║
╚════════════════════════════════════════════╝
  `);
});