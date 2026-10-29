# Fixkosten-App

Selbst gehostete Web-App für die private Finanzplanung zu zweit: Wie viel muss jeden Monat für Fixkosten zurückgelegt werden, reicht der Kontostand, und wer überweist wie viel aufs Gemeinschaftskonto.

Läuft als einzelner Docker-Container, gedacht für Dockge auf TrueNAS. Actual Budget lässt sich optional anbinden.

## Stand

- [x] Grundgerüst: SvelteKit, Docker-Image, Stack für Dockge
- [x] Rechenkern mit Akzeptanztests (`src/lib/rechnung`)
- [ ] Oberfläche mit Personenauswahl, Speicherung in SQLite
- [ ] Anbindung an Actual Budget

## Rechenkern

Alle Beträge sind ganze Cent, alle Daten `JJJJ-MM-TT`.

| Datei | Inhalt |
| --- | --- |
| `fixkosten.ts` | Umlage der Fixkosten auf Monate, letzte und nächste Buchung, Soll-Kontostand zum Stichtag |
| `gemeinschaft.ts` | Summe fürs Gemeinschaftskonto und Anteil jeder Person (Modell A nach Netto, Modell B gleicher Rest) |
| `aufstellung.ts` | Monatsaufstellung und Daueraufträge vom Gehaltskonto, Modus 1 (Spaß fix) und Modus 2 (Fixkosten-Konto) |
| `status.ts` | Soll-Ist-Vergleich mit Puffer, ausstehende Daueraufträge werden herausgerechnet |

Die Tests in `*.test.ts` enthalten alle Akzeptanzwerte der alten Tabelle (Stichtage 28.09.2026, 01.10.2026, 07.10.2026, 08.10.2026, 15.01.2027) und den korrigierten Monatsende-Fall.

## Entwicklung

```sh
npm install
npm test        # Rechenkern testen
npm run dev     # Entwicklungsserver
npm run build   # Produktions-Build nach build/
```

## Betrieb mit Dockge

Bei jedem Push auf `main` baut GitHub Actions das Image `ghcr.io/quqide/fixkosten-app:latest`.

1. In Dockge einen neuen Stack `fixkosten` anlegen und den Inhalt von [`compose.yaml`](compose.yaml) einfügen.
2. `POOL` im Datenpfad durch deinen Pool ersetzen und den Ordner vorher anlegen. Der Container läuft als Benutzer mit der ID 1000, der Ordner muss für ihn beschreibbar sein.
3. `ORIGIN` auf die Adresse setzen, unter der du die App aufrufst.
4. Stack starten. Updates holst du mit „Update“ in Dockge.

Das Repository ist privat, deshalb ist auch das Image zunächst privat. Damit Dockge es ohne Anmeldung laden kann, das Paket unter GitHub → Packages → `fixkosten-app` → Package settings auf „Public“ stellen. Das Image enthält keine persönlichen Daten, die liegen nur im Datenordner.
