# Fuelio – Tankmanager

Fuelio ist eine mobile-first Web-App zur Verwaltung von Fahrzeugen, Tankvorgängen, Statistiken und druckfertigen Monatsabrechnungen. Sie läuft vollständig im Browser und eignet sich für statisches Hosting über GitHub Pages.

## Funktionen

- Dashboard mit Monatskosten, Litern, Anzahl, Durchschnittspreis und letztem Tankvorgang
- Mehrere Fahrzeuge anlegen und bearbeiten
- Tankvorgänge hinzufügen, bearbeiten und löschen
- Automatische Berechnung von Gesamtpreis und Preis pro Liter
- Historie mit Filtern nach Monat, Jahr und Fahrzeug
- Professionelle Monatsabrechnung als echte PDF-Datei
- Direktes Teilen der PDF über das native Teilen-Menü unterstützter Smartphones
- Monatsstatistiken für Kosten, Liter und Kraftstoffpreis
- Dauerhafte, versionierte Speicherung im `localStorage`
- Responsive Dark-Mode-Oberfläche für Smartphone und Desktop

## Lokal starten

Voraussetzung: Node.js 22 oder neuer und pnpm.

```bash
pnpm install
pnpm dev
```

Vite zeigt anschließend die lokale Adresse an, in der Regel `http://localhost:5173`.

Produktions-Build und Tests:

```bash
pnpm test
pnpm build
pnpm preview
```

Der fertige statische Build liegt in `dist/`.

## Auf GitHub Pages veröffentlichen

Der Workflow `.github/workflows/deploy-pages.yml` ist bereits eingerichtet.

1. Projekt in ein GitHub-Repository übertragen.
2. In GitHub unter **Settings → Pages** als Quelle **GitHub Actions** auswählen.
3. Auf den Branch `main` pushen.
4. Der Workflow testet und baut die App und veröffentlicht anschließend `dist/`.

Die Vite-Konfiguration verwendet relative Asset-Pfade. Dadurch funktioniert die App sowohl unter einer Benutzer-Domain als auch unter einem Repository-Unterpfad wie `https://name.github.io/repository/`.

## Projektaufbau

```text
src/
  main.jsx       Oberfläche, Navigation, Formulare und Ansichten
  domain.js      Berechnungen, Formatierung und Speicherung
  styles.css     Designsystem, Responsive Layout und Druckansicht
tests/
  domain.test.js Tests für Berechnung, Filter und Speicherung
.github/workflows/
  deploy-pages.yml Automatische Veröffentlichung
```

Die Kernlogik ist bewusst von der Oberfläche getrennt. Das hält Berechnungen und Datenspeicherung testbar und erleichtert eine spätere Anbindung an ein Backend.

## Datenspeicherung

Alle Daten werden als versionierter Datensatz unter `fuelio:data:v1` im `localStorage` des Browsers gespeichert. Sie bleiben nach Neuladen und Schließen der Seite erhalten.

Wichtig: Die Daten sind an den jeweiligen Browser und das Gerät gebunden. Ein anderer Browser oder ein anderes Smartphone sieht diese Daten nicht. Das Löschen der Browserdaten entfernt auch die Fuelio-Daten. Für die rein statische GitHub-Pages-Version ist das die zuverlässigste Lösung ohne Backend, Benutzerkonto oder laufende Kosten.

## Später Supabase anbinden

Für geräteübergreifende Synchronisierung lässt sich Supabase ergänzen:

1. Tabellen `vehicles` und `refuels` mit denselben Feldern wie in `domain.js` anlegen.
2. Supabase Auth für Benutzerkonten aktivieren und jeder Zeile eine `user_id` zuweisen.
3. Row Level Security aktivieren, damit Benutzer ausschließlich ihre eigenen Daten lesen und ändern können.
4. Eine kleine Repository-Schicht einführen, deren Methoden `loadStoredData` und `saveStoredData` ersetzen.
5. Bestehende lokale Datensätze einmalig nach erfolgreichem Login importieren.
6. Supabase-URL und öffentlichen Anon-Key als GitHub-Actions-Variablen beim Build setzen. Den Service-Role-Key niemals im Browser verwenden.

So bleibt die Oberfläche unverändert; lediglich die Datenquelle wird ausgetauscht.

## Mögliche Erweiterungen

- JSON-Export und -Import als lokale Sicherung
- Verbrauchsberechnung in l/100 km anhand aufeinanderfolgender Kilometerstände
- Cloud-Synchronisierung und Benutzerkonten
- CSV-Export für Buchhaltung oder Fahrtenbuch
- Installierbare PWA mit Offline-Cache

## Datenschutz

Die aktuelle Version sendet keine Fahrzeug- oder Tankdaten an einen Server. Lediglich die Schriftart wird beim ersten Aufruf von Google Fonts geladen. Wer vollständig ohne externe Requests arbeiten möchte, kann die Schrift entfernen oder lokal mit ausliefern.

### PDF und Teilen

Die Abrechnung wird vollständig im Browser als PDF erzeugt. Auf Smartphones mit Unterstützung für die Web Share API öffnet **Abrechnung teilen** das native Teilen-Menü und übergibt die PDF als Datei – dort kann sie beispielsweise an eine Mail-App, einen Messenger oder AirDrop weitergereicht werden. Auf nicht unterstützten Browsern wird die PDF automatisch heruntergeladen. Ein vollautomatischer E-Mail-Versand mit Anhang benötigt einen abgesicherten Backend-Dienst und ist in der statischen GitHub-Pages-Version bewusst nicht enthalten.
