# Fixkosten-App

Selbst gehostete Web-App für die private Finanzplanung zu zweit: Wie viel muss jeden Monat für Fixkosten zurückgelegt werden, reicht der Kontostand, und wer überweist wie viel aufs Gemeinschaftskonto.

Läuft als einzelner Docker-Container, gedacht für Dockge auf TrueNAS. Actual Budget lässt sich optional anbinden.

## Stand

- [x] Grundgerüst: SvelteKit, Docker-Image, Stack für Dockge
- [x] Rechenkern mit Akzeptanztests (`src/lib/rechnung`)
- [x] Oberfläche mit Personenauswahl, Speicherung in SQLite, Farbthemen, Rückgängig, Sicherung
- [x] Kontostand aus Actual Budget, mit Erkennung von Gehalt und Daueraufträgen
- [ ] Buchungen den Fixkosten zuordnen, Preisänderungen melden

## Rechenkern

Alle Beträge sind ganze Cent, alle Daten `JJJJ-MM-TT`.

| Datei | Inhalt |
| --- | --- |
| `fixkosten.ts` | Umlage der Fixkosten auf Monate, letzte und nächste Buchung, Soll-Kontostand zum Stichtag |
| `gemeinschaft.ts` | Summe fürs Gemeinschaftskonto und Anteil jeder Person (Modell A nach Netto, Modell B gleicher Rest) |
| `aufstellung.ts` | Monatsaufstellung und Daueraufträge vom Gehaltskonto, Modus 1 (Spaß fix) und Modus 2 (Fixkosten-Konto) |
| `status.ts` | Soll-Ist-Vergleich mit Puffer, ausstehende Daueraufträge werden herausgerechnet |

Die Tests in `*.test.ts` enthalten alle Akzeptanzwerte der alten Tabelle (Stichtage 28.09.2026, 01.10.2026, 07.10.2026, 08.10.2026, 15.01.2027) und den korrigierten Monatsende-Fall.

## Oberfläche

| Seite | Inhalt |
| --- | --- |
| Übersicht | Reicht das Geld? Soll und Ist mit Ring, Daueraufträge am Überweisungstag, nächste Abbuchungen, Rücklage der nächsten 12 Monate. Mit `?stichtag=JJJJ-MM-TT` lässt sich jeder Tag ansehen. |
| Fixkosten | Eigene Posten anlegen, ändern und löschen, Anteile anderer direkt am Posten |
| Gemeinsam | Miete, Alltag, Rücklage und gemeinsame Fixkosten; Aufteilung nach Gehalt oder gleichem Rest |
| Einstellungen | Kontenmodell, Gehalt, Rücklagen, Farbthema, Sicherung herunterladen und einspielen, letzte Änderungen mit Rückgängig |

Beim ersten Öffnen wählt jede Person aus, wer sie ist (Cookie, kein Passwort). Beide sehen und ändern alle Daten. Jede Änderung landet im Verlauf und lässt sich rückgängig machen.

Die Daten liegen in `DATA_DIR/fixkosten.db` (SQLite, eingebaut in Node 22).

## Entwicklung

```sh
npm install
npm test        # Rechenkern testen
npm run dev     # Entwicklungsserver
npm run build   # Produktions-Build nach build/
npm start       # gebaute App starten (Daten in ./data)
```

## Betrieb mit Dockge

Bei jedem Push auf `main` baut GitHub Actions das Image `ghcr.io/quqide/fixkosten-app:latest`.

1. In Dockge einen neuen Stack `fixkosten` anlegen und den Inhalt von [`compose.yaml`](compose.yaml) einfügen.
2. `POOL` im Datenpfad durch deinen Pool ersetzen und den Ordner vorher anlegen. Der Container läuft als Benutzer mit der ID 1000, der Ordner muss für ihn beschreibbar sein. Gehört der Ordner dem TrueNAS-Benutzer „apps“ (568), in `compose.yaml` die Zeile `user: "568:568"` aktivieren. Ist der Ordner nicht beschreibbar, zeigt die App das direkt im Browser an.
3. Stack starten und `http://<NAS>:3080` öffnen. Updates holst du mit „Update“ in Dockge.

Das Repository ist privat, deshalb ist auch das Image zunächst privat. Damit Dockge es ohne Anmeldung laden kann, das Paket unter GitHub → Packages → `fixkosten-app` → Package settings auf „Public“ stellen. Das Image enthält keine persönlichen Daten, die liegen nur im Datenordner.

### Actual Budget anbinden (freiwillig)

Pro Person, die Actual nutzt, im Stack diese Umgebungsvariablen setzen (für die zweite Person `ACTUAL_B_…`):

| Variable | Inhalt |
| --- | --- |
| `ACTUAL_A_URL` | Adresse des Actual-Servers, z. B. `http://192.168.1.10:5006` |
| `ACTUAL_A_PASSWORD` | Passwort des Actual-Servers |
| `ACTUAL_A_SYNC_ID` | Sync-ID des Budgets (Actual → Einstellungen → Erweitert) |
| `ACTUAL_A_E2E_PASSWORD` | nur bei Ende-zu-Ende-Verschlüsselung |

Danach unter Einstellungen das Konto wählen (Modus 1: Gehaltskonto, Modus 2: Fixkosten-Konto) und „Jetzt abrufen“. Die App liest nur und ändert nichts in Actual.

- **Terminpläne zuordnen:** Jeder Terminplan ist Fixkosten, ein Dauerauftrag oder wird nicht berücksichtigt. Fixkosten übernimmt die App mit Name, Betrag, Rhythmus und nächstem Termin; diese Felder sind in der App dann gesperrt. Gleichnamige, von Hand angelegte Posten werden zur Verknüpfung vorgeschlagen.
- **Gehalt:** an einer Einnahmen-Kategorie erkannt, sonst an einer Gutschrift ab 70 % des Nettos.
- **Daueraufträge:** am zugeordneten Terminplan erkannt, sonst am Betrag (±1 €). Noch nicht gebuchte Daueraufträge werden vom Kontostand abgezogen.
- **Prüfung:** fehlende Kategorie, falsches Konto, ungefährer Betrag, nicht abbildbarer Rhythmus, Preisabweichung der letzten Buchung, überfällige Termine, doppelte oder verschwundene Terminpläne und Daueraufträge mit anderem Betrag als berechnet werden als Warnung oder Hinweis angezeigt.

Abgerufen wird einmal am Tag beim Öffnen der Übersicht und auf Knopfdruck. Eine lokale Kopie des Budgets liegt unter `/data/actual`.
