# Österreich Events — Product Vision

## Auth & User System

### Anmeldemethoden
- Google OAuth
- Apple Sign-In
- Email + Passwort (klassisch)

### Rollen
| Rolle | Beschreibung |
|---|---|
| **God** (Admin) | Volle Kontrolle, spezielle Admin-Ansicht, nur für Owner |
| **Business** | Verifiziertes Unternehmen, kann offizielle Events posten + Shop/Ticketing |
| **User** | Standard-User, kann private/öffentliche Events posten |

### Pflichtfelder User
- Vorname
- Nachname
- Geburtsdatum
- Email-Adresse
- Telefonnummer

### Optionale Felder User
- Profilbild
- Adresse
- Bio/Beschreibung
- Social Links

### Pflichtfelder Business (zusätzlich)
- Firmenname
- UID-Nummer
- Firmenadresse
- Rechtsform
- Ansprechperson
- Firmen-Logo

---

## Core Features

### 1. Event Management
- **User Events**: Jeder User kann Events erstellen (öffentlich/privat)
- **Business Events**: Offizielle Veranstaltungen mit Ticketing
- **Scraped Events**: Automatisch aggregierte Events (bestehend)

### 2. Ticketing & Shop
- Business-Accounts können eigenen Shop betreiben
- Zahlungsabwicklung unter ÖE-Brand (Stripe?)
- Warenkorb-System
- In-App-Käufe (für spätere Mobile App)
- Affiliate-Links für externe Tickets (oeticket, Ticketmaster)

### 3. Social Features
- **Gruppen-Dashboard**: Gemeinsamer Chat, Fotos teilen, Events teilen
- **Erinnerungen**: "Ihr wart zusammen beim Donauinselfest 2025!"
- **Event-Sharing**: Events an andere User/Gruppen senden
- **Tracking**: Welche Events User zusammen besucht haben

### 4. Spotify-Integration
- Musikgeschmack analysieren (Top Artists, Genres)
- Automatisch Konzerte von Lieblings-Artists finden
- Smart Notifications: "DJ XY spielt nächste Woche in Wien — Ticket kaufen?"
- Musik-basierte Event-Empfehlungen
- Conversion-driven: Immer mit Ticket-Link / CTA

### 5. Facebook-Integration
- Events von Facebook importieren
- Freunde einladen die auf Facebook sind
- Event-Sharing zu Facebook

### 6. Benachrichtigungen / Smart Recommendations
- Push-Notifications (Web + später Mobile)
- "Hey, [Artist] kommt bald nach [Stadt] — magst nicht hin?"
- Erinnerungen für gemerkte Events
- Gruppen-Erinnerungen
- Conversion-driven mit Ticket-Links

---

## Technische Berücksichtigungen

### Mobile App (Zukunft)
- Web-First, dann Android + iOS
- Shared API Backend (Next.js API Routes → später eigenständige API)
- Push Notifications vorbereiten (Web Push API)
- Responsive Design als Grundlage

### Datenbank-Migration
- SQLite → PostgreSQL (für Multi-User, Concurrent Access)
- Oder: SQLite beibehalten + separate User-DB in PostgreSQL

### Payment
- Stripe Integration (EU-konform, SCA-ready)
- Oder: Mollie (NL-basiert, gut für AT/DE)
- In-App Purchase Vorbereitung (Apple/Google Pay)

---

## Monetarisierung
1. **Affiliate Commissions** (oeticket, Ticketmaster, Reservix)
2. **Business Accounts** (monatliche Gebühr für Ticketing/Shop)
3. **Promoted Events** (Businesses zahlen für Sichtbarkeit)
4. **Ticket-Provision** (% von über ÖE verkauften Tickets)
5. **Premium User Features** (erweiterte Gruppen, Analytics)
