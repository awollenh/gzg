# GZG - Geld Zurück Garantie

Ein System zur Verwaltung von Einkaufsbelegen und Personendatensätzen mit KI-gestützter Bildverarbeitung.

## Features

- 📷 **KI-gestützte Bildverarbeitung** mit Google Gemini AI
- 👥 **Personendatensatz-Verwaltung** mit automatischer Zuweisung
- ⚙️ **Aktionen-Verwaltung** für verschiedene Einkaufsgruppen
- 💾 **Automatische Speicherung** von Produkten und Fotos
- 🗑️ **Löschen-Funktion** für Aktionen
- 🚀 **Einfacher Start** mit Batch-Datei für Windows

## Installation

### 1. Abhängigkeiten installieren
```bash
npm install
```

### 2. Gemini AI API-Schlüssel einrichten
1. Gehen Sie zu [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Erstellen Sie einen neuen API-Schlüssel
3. Kopieren Sie den Schlüssel

### 3. Umgebungsvariablen konfigurieren
Erstellen Sie eine `.env` Datei im Projektverzeichnis:
```bash
# Kopieren Sie die Beispiel-Datei (falls vorhanden)
cp config.env.example .env

# Bearbeiten Sie die .env Datei und fügen Sie Ihren API-Schlüssel ein
GEMINI_API_KEY=ihr_gemini_api_schlüssel_hier
PORT=8000
```

## Server starten

### Option 1: Mit Batch-Datei (Windows)
```bash
# Doppelklick auf start_server.bat oder:
start_server.bat
```

### Option 2: Mit npm-Befehlen
```bash
# Entwicklung (mit Auto-Reload)
npm run dev

# Produktion
npm start
```

## Verwendung

1. **Startseite**: `http://localhost:8000`
2. **Konfiguration**: Aktionen verwalten und Personendaten einsehen
3. **Foto-Upload**: Bilder hochladen und automatisch verarbeiten lassen

## API-Endpunkte

### Bildverarbeitung
- `POST /api/process-image` - Bild mit Gemini AI verarbeiten

### Aktionen-Verwaltung
- `GET /api/actions` - Alle Aktionen abrufen
- `POST /api/actions` - Neue Aktion erstellen
- `DELETE /api/actions/:id` - Aktion löschen

### Personendaten-Verwaltung
- `GET /api/actions/:id/available-persons` - Verfügbare Personendaten für eine Aktion abrufen
- `GET /api/actions/:id/next-person` - Nächsten verfügbaren Personendatensatz für eine Aktion abrufen

### Daten-Speicherung
- `POST /api/save-products` - Ausgewählte Produkte speichern (mit Foto-Upload)

### Foto-Anzeige
- `GET /api/photo/:filename` - Foto aus JSON-Datei anzeigen

## Technologie-Stack

- **Backend**: Node.js, Express
- **AI**: Google Gemini 2.0 Flash (@google/generative-ai)
- **Frontend**: HTML, CSS, JavaScript
- **Datei-Upload**: Multer
- **CORS**: Cross-Origin Resource Sharing
- **Entwicklung**: Nodemon für Auto-Reload

## Dateistruktur

```
gzg/
├── server.js              # Hauptserver
├── index.html             # Startseite
├── config.html            # Konfigurationsseite
├── foto_upload_simple.html # Foto-Upload-Seite
├── personendaten.json     # Personendatensätze
├── actions.json           # Aktionen-Daten
├── start_server.bat       # Windows Start-Skript
├── saved_data/            # Gespeicherte Daten
├── uploads/               # Temporäre Uploads
├── package.json           # Abhängigkeiten
└── package-lock.json      # Abhängigkeiten-Lock
```

## Abhängigkeiten

### Hauptabhängigkeiten
- `@google/generative-ai`: Google Gemini AI Integration
- `express`: Web-Framework
- `multer`: Datei-Upload-Handling
- `cors`: Cross-Origin Resource Sharing

### Entwicklungsabhängigkeiten
- `nodemon`: Auto-Reload für Entwicklung

### Optionale Abhängigkeiten
- `dotenv`: Umgebungsvariablen-Verwaltung

## Hinweise

- Stellen Sie sicher, dass Sie einen gültigen Gemini API-Schlüssel haben
- Die AI-Verarbeitung kann je nach Bildqualität variieren
- Alle Daten werden lokal gespeichert
- Für die Entwicklung wird Nodemon empfohlen (Auto-Reload bei Code-Änderungen)
- Die `start_server.bat` Datei bietet eine einfache Möglichkeit, den Server unter Windows zu starten 