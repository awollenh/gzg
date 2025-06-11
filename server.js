const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Lade Umgebungsvariablen aus .env Datei (falls vorhanden)
try {
    require('dotenv').config();
} catch (error) {
    console.log('dotenv nicht installiert, verwende Standard-Umgebungsvariablen');
}

const app = express();
const PORT = process.env.PORT || 8000;

// Gemini AI Konfiguration
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY');
//const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });

// Middleware
app.use(cors());
app.use(express.json());

// Multer für Datei-Uploads
const upload = multer({ dest: 'uploads/' });

// Pfad zur JSON-Datei für Aktionen
const ACTIONS_FILE = 'actions.json';

// Pfad zur JSON-Datei für Personendaten
const PERSONENDATEN_FILE = 'personendaten.json';

// Ordner für gespeicherte Daten
const SAVED_DATA_DIR = 'saved_data';

// Ordner erstellen falls nicht vorhanden
function ensureDirectories() {
    if (!fs.existsSync(SAVED_DATA_DIR)) {
        fs.mkdirSync(SAVED_DATA_DIR);
    }
    if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads');
    }
}

// Aktionen-Datei initialisieren (falls nicht vorhanden)
function initializeActionsFile() {
    if (!fs.existsSync(ACTIONS_FILE)) {
        fs.writeFileSync(ACTIONS_FILE, JSON.stringify([], null, 2));
    }
}

// Aktionen laden
function loadActions() {
    try {
        const data = fs.readFileSync(ACTIONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Fehler beim Laden der Aktionen:', error);
        return [];
    }
}

// Aktionen speichern
function saveActions(actions) {
    try {
        fs.writeFileSync(ACTIONS_FILE, JSON.stringify(actions, null, 2));
        return true;
    } catch (error) {
        console.error('Fehler beim Speichern der Aktionen:', error);
        return false;
    }
}

// Personendaten laden
function loadPersonendaten() {
    try {
        const data = fs.readFileSync(PERSONENDATEN_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Fehler beim Laden der Personendaten:', error);
        return [];
    }
}

// Verfügbare Personendatensätze für eine Aktion ermitteln
function getAvailablePersonendaten(actionId) {
    try {
        const actions = loadActions();
        const personendaten = loadPersonendaten();
        
        const action = actions.find(a => a.id == actionId);
        if (!action) return [];
        
        // Verwende die Einträge der Aktion, um zu sehen, welche Personendaten bereits verwendet wurden
        const usedPersonIndices = action.entries.map(entry => entry.personIndex).filter(index => index !== undefined);
        
        // Filtere verfügbare Personendaten
        const availablePersonendaten = personendaten.filter((_, index) => !usedPersonIndices.includes(index));
        
        return availablePersonendaten;
    } catch (error) {
        console.error('Fehler beim Ermitteln verfügbarer Personendaten:', error);
        return [];
    }
}

// Nächsten freien Personendatensatz für eine Aktion ermitteln
function getNextAvailablePerson(actionId) {
    const available = getAvailablePersonendaten(actionId);
    return available.length > 0 ? available[0] : null;
}

// === API-Routen müssen vor express.static definiert werden! ===

// Bild mit Gemini AI verarbeiten
app.post('/api/process-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Kein Bild hochgeladen' });
        }

        // Bild als Base64 lesen
        const imageBuffer = fs.readFileSync(req.file.path);
        const base64Image = imageBuffer.toString('base64');
        
        // Temporäre Datei löschen
        fs.unlinkSync(req.file.path);

        // Gemini AI Prompt
        const prompt = `
        Analysiere dieses Bild eines Einkaufsbelegs/Quittung und extrahiere alle Produkte mit folgenden Informationen:
        - Produktname
        - Preis
        - Datum (falls sichtbar)
        - Supermarkt/Shop (falls sichtbar)

        Antworte NUR mit einem JSON-Array im folgenden Format:
        [
          {
            "Produkt": "Produktname",
            "Preis": "Preis in Euro",
            "Datum": "Datum (falls sichtbar)",
            "Supermarkt/Shop": "Shop-Name (falls sichtbar)"
          }
        ]

        Falls keine Produkte erkennbar sind, gib ein leeres Array zurück: []
        
        Wichtig: Antworte nur mit dem JSON, keine zusätzlichen Erklärungen.
        `;

        // Bild an Gemini senden
        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: req.file.mimetype
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        // JSON aus der Antwort extrahieren
        let products = [];
        try {
            // Versuche, JSON aus der Antwort zu extrahieren
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                products = JSON.parse(jsonMatch[0]);
            } else {
                // Fallback: Versuche die gesamte Antwort als JSON zu parsen
                products = JSON.parse(text);
            }
        } catch (parseError) {
            console.error('Fehler beim Parsen der AI-Antwort:', parseError);
            console.log('AI-Antwort:', text);
            return res.status(500).json({ 
                error: 'Fehler beim Verarbeiten der AI-Antwort',
                rawResponse: text 
            });
        }

        res.json({
            success: true,
            products: products,
            rawResponse: text
        });

    } catch (error) {
        console.error('Fehler bei der Bildverarbeitung:', error);
        res.status(500).json({ 
            error: 'Fehler bei der Bildverarbeitung: ' + error.message 
        });
    }
});

// Alle Aktionen abrufen
app.get('/api/actions', (req, res) => {
    const actions = loadActions();
    res.json(actions);
});

// Verfügbare Personendaten für eine Aktion abrufen
app.get('/api/actions/:id/available-persons', (req, res) => {
    const { id } = req.params;
    const available = getAvailablePersonendaten(id);
    res.json(available);
});

// Nächsten verfügbaren Personendatensatz für eine Aktion abrufen
app.get('/api/actions/:id/next-person', (req, res) => {
    const { id } = req.params;
    const nextPerson = getNextAvailablePerson(id);
    if (nextPerson) {
        res.json(nextPerson);
    } else {
        res.status(404).json({ error: 'Keine verfügbaren Personendatensätze' });
    }
});

// Neue Aktion erstellen
app.post('/api/actions', (req, res) => {
    const { name, description } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Name ist erforderlich' });
    }

    const actions = loadActions();
    const personendaten = loadPersonendaten();
    
    // Prüfe ob Name bereits existiert
    if (actions.some(action => action.name === name)) {
        return res.status(400).json({ error: 'Eine Aktion mit diesem Namen existiert bereits' });
    }

    const newAction = {
        id: Date.now(),
        name: name,
        description: description || '',
        personCount: 0,
        maxPersons: personendaten.length, // Maximale Anzahl basierend auf verfügbaren Personendaten
        entries: [],
        createdAt: new Date().toISOString()
    };

    actions.push(newAction);
    
    if (saveActions(actions)) {
        res.json(newAction);
    } else {
        res.status(500).json({ error: 'Fehler beim Speichern der Aktion' });
    }
});

// Aktion löschen
app.delete('/api/actions/:id', (req, res) => {
    const { id } = req.params;
    
    const actions = loadActions();
    const actionToDelete = actions.find(action => action.id == id);
    
    if (!actionToDelete) {
        return res.status(404).json({ error: 'Aktion nicht gefunden' });
    }
    
    // Lösche zugehörige JSON-Dateien
    if (actionToDelete.entries && actionToDelete.entries.length > 0) {
        const uniqueJsonFiles = [...new Set(actionToDelete.entries.map(entry => entry.jsonFile).filter(file => file))];
        
        uniqueJsonFiles.forEach(jsonFile => {
            const filePath = path.join(SAVED_DATA_DIR, jsonFile);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`Gelöscht: ${jsonFile}`);
                }
            } catch (error) {
                console.error(`Fehler beim Löschen von ${jsonFile}:`, error);
            }
        });
    }
    
    const filteredActions = actions.filter(action => action.id != id);
    
    if (saveActions(filteredActions)) {
        res.json({ message: 'Aktion erfolgreich gelöscht' });
    } else {
        res.status(500).json({ error: 'Fehler beim Löschen der Aktion' });
    }
});

// Ausgewählte Produkte speichern
app.post('/api/save-products', upload.single('photo'), (req, res) => {
    try {
        const { actionData, selectedProducts, originalFileName } = req.body;
        
        if (!actionData || !selectedProducts) {
            return res.status(400).json({ error: 'Fehlende Daten' });
        }

        const action = JSON.parse(actionData);
        const products = JSON.parse(selectedProducts);
        
        // Foto als Base64 konvertieren (falls vorhanden)
        let photoBase64 = null;
        if (req.file) {
            const photoBuffer = fs.readFileSync(req.file.path);
            photoBase64 = photoBuffer.toString('base64');
            fs.unlinkSync(req.file.path); // Lösche temporäre Datei
        }
        
        // Erstelle Speicherdaten
        const saveData = {
            timestamp: new Date().toISOString(),
            action: action,
            originalFile: originalFileName,
            selectedProducts: products,
            photo: photoBase64, // Base64-kodiertes Foto
            savedOnServer: true
        };

        // Generiere Dateinamen
        const timestamp = new Date().toISOString().split('T')[0];
        const actionName = action.name.replace(/[^a-zA-Z0-9]/g, '_');
        const dataFileName = `gzg_${actionName}_${timestamp}.json`;

        // Speichere JSON-Daten mit eingebettetem Foto
        const dataPath = path.join(SAVED_DATA_DIR, dataFileName);
        fs.writeFileSync(dataPath, JSON.stringify(saveData, null, 2));

        // Aktualisiere die actions.json mit den neuen Einträgen
        const actions = loadActions();
        const actionIndex = actions.findIndex(a => a.id == action.id);
        
        let selectedPerson = null;
        
        if (actionIndex !== -1) {
            const currentAction = actions[actionIndex];
            
            // Prüfe ob noch Platz verfügbar ist
            if (currentAction.personCount >= currentAction.maxPersons) {
                return res.status(400).json({ error: `Aktion ist voll (${currentAction.personCount}/${currentAction.maxPersons} Personendatensätze verwendet)` });
            }
            
            // Finde den nächsten verfügbaren Personendatensatz
            const personendaten = loadPersonendaten();
            const usedPersonIndices = currentAction.entries.map(entry => entry.personIndex).filter(index => index !== undefined);
            let nextPersonIndex = 0;
            
            while (usedPersonIndices.includes(nextPersonIndex) && nextPersonIndex < personendaten.length) {
                nextPersonIndex++;
            }
            
            if (nextPersonIndex >= personendaten.length) {
                return res.status(400).json({ error: 'Keine verfügbaren Personendatensätze' });
            }
            
            selectedPerson = personendaten[nextPersonIndex];
            
            // Füge jeden ausgewählten Produkt als Eintrag hinzu
            products.forEach(product => {
                const newEntry = {
                    id: Date.now() + Math.random(), // Eindeutige ID
                    product: product.Produkt || product.name || 'Unbekanntes Produkt',
                    price: product.Preis || product.price || '',
                    date: product.Datum || timestamp,
                    shop: product['Supermarkt/Shop'] || '',
                    personIndex: nextPersonIndex,
                    personData: selectedPerson,
                    createdAt: new Date().toISOString(),
                    jsonFile: dataFileName // <-- Dateiname der JSON-Datei
                };
                currentAction.entries.push(newEntry);
            });
            
            // Erhöhe personCount (maximal maxPersons)
            currentAction.personCount = Math.min(currentAction.personCount + 1, currentAction.maxPersons);
            
            // Speichere aktualisierte actions.json
            if (!saveActions(actions)) {
                return res.status(500).json({ error: 'Fehler beim Speichern der Aktionen' });
            }
        } else {
            return res.status(404).json({ error: 'Aktion nicht gefunden' });
        }

        res.json({
            success: true,
            message: `${products.length} Produkt(e) erfolgreich gespeichert`,
            dataFile: dataFileName,
            savedPath: dataPath,
            photoIncluded: !!photoBase64,
            entriesAdded: products.length,
            personData: selectedPerson
        });

    } catch (error) {
        console.error('Fehler beim Speichern:', error);
        res.status(500).json({ error: 'Fehler beim Speichern der Daten: ' + error.message });
    }
});

// Foto aus JSON-Datei anzeigen
app.get('/api/photo/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(SAVED_DATA_DIR, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Datei nicht gefunden' });
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (!data.photo) {
            return res.status(404).json({ error: 'Kein Foto in der Datei gefunden' });
        }

        // Base64 zu Buffer konvertieren
        const photoBuffer = Buffer.from(data.photo, 'base64');
        
        res.setHeader('Content-Type', 'image/jpeg');
        res.send(photoBuffer);

    } catch (error) {
        console.error('Fehler beim Laden des Fotos:', error);
        res.status(500).json({ error: 'Fehler beim Laden des Fotos' });
    }
});

// === Statische Dateien zuletzt! ===
app.use(express.static('.'));

// Server starten
ensureDirectories();
initializeActionsFile();

app.listen(PORT, () => {
    console.log(`GZG-Server läuft auf http://localhost:${PORT}`);
    console.log(`Startseite: http://localhost:${PORT}/`);
    console.log(`Config-Seite: http://localhost:${PORT}/config.html`);
    console.log(`Upload-Seite: http://localhost:${PORT}/foto_upload_simple.html`);
}); 