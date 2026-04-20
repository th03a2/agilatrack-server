# AgilaTrack Server

Express and MongoDB API for AgilaTrack club, loft, affiliation, officer, and racing data.

## Setup

Create `server/.env` with:

```env
MONGO_URI=your_mongodb_connection_string
PORT=5000
```

Install dependencies and run the API:

```bash
npm install
npm run dev
```

## Seed Data

The seeder creates a realistic Philippine racing pigeon sample network:

- National federation: Philippine Homing Pigeon Racing Federation
- Regional councils: CALABARZON and Central Luzon
- Provincial associations: Cavite, Laguna, and Tarlac
- Municipality clubs: Indang, Silang, Calamba, and Tarlac City
- Users, affiliations, lofts, and officers
- Sample races and race entries for booking, check-in, boarding, departure, arrival, speed, distance, and ranking

Run without deleting existing matching seed records:

```bash
npm run seed
```

Clean and recreate only the seeded sample records:

```bash
npm run seed:reset
```

Default password for all seeded users:

```txt
Password123!
```

## Seed Accounts

| Email | Name | Club | Officer Role |
| --- | --- | --- | --- |
| `juan.delacruz@agilatrack.test` | Juan Dela Cruz | Indang Flyers Club | President |
| `maria.santos@agilatrack.test` | Maria Santos | Indang Flyers Club | Secretary |
| `pedro.ramos@agilatrack.test` | Pedro Ramos | Indang Flyers Club | Treasurer |
| `ana.lopez@agilatrack.test` | Ana Lopez | Indang Flyers Club | Race Secretary |
| `carlo.mendoza@agilatrack.test` | Carlo Mendoza | Silang High Flyers Club | President |
| `liza.cruz@agilatrack.test` | Liza Cruz | Calamba Loft Masters Club | President |
| `roberto.galang@agilatrack.test` | Roberto Galang | Tarlac City Racing Flyers | President |

## Seed Races

| Race Code | Race Name | Status |
| --- | --- | --- |
| `IFC-2026-TAR-100` | Indang Flyers Tarlac 100KM Training Race | Departed with sample arrivals |
| `IFC-2026-SBC-150` | Indang Flyers Subic 150KM Futurity | Booking open |

## Current Routes

Health and route list:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | API health and endpoint summary |
| GET | `/api/routes` | List available API routes |

Clubs:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/clubs` | List clubs |
| GET | `/api/clubs/meta/levels` | List club hierarchy levels |
| GET | `/api/clubs/pyramid` | Fetch full club pyramid |
| GET | `/api/clubs/:id/tree` | Fetch club subtree |
| GET | `/api/clubs/:id/children` | Fetch direct child clubs |
| GET | `/api/clubs/:id` | Fetch one club |
| POST | `/api/clubs` | Create club |
| PUT | `/api/clubs/:id` | Update club |
| DELETE | `/api/clubs/:id` | Archive club |

Lofts:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/lofts` | List lofts |
| GET | `/api/lofts/:id` | Fetch one loft |
| POST | `/api/lofts` | Create loft |
| PUT | `/api/lofts/:id` | Update loft |
| DELETE | `/api/lofts/:id` | Archive loft |

Users:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/users` | List users |
| GET | `/api/users/:id` | Fetch one user |
| POST | `/api/users` | Create user |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Deactivate user |

Affiliations:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/affiliations` | List affiliations |
| GET | `/api/affiliations/:id` | Fetch one affiliation |
| POST | `/api/affiliations` | Create affiliation |
| PUT | `/api/affiliations/:id` | Update affiliation |
| DELETE | `/api/affiliations/:id` | Archive affiliation |

Officers:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/officers` | List officers |
| GET | `/api/officers/:id` | Fetch one officer |
| POST | `/api/officers` | Create officer |
| PUT | `/api/officers/:id` | Update officer |
| DELETE | `/api/officers/:id` | Archive officer |

Races:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/races` | List races |
| GET | `/api/races/:id` | Fetch one race |
| POST | `/api/races` | Create race |
| PUT | `/api/races/:id` | Update race |
| DELETE | `/api/races/:id` | Archive race |

Race entries:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/race-entries` | List race entries |
| GET | `/api/race-entries/:id` | Fetch one race entry |
| POST | `/api/race-entries` | Book a race entry |
| PUT | `/api/race-entries/:id` | Update race entry |
| PUT | `/api/race-entries/:id/check-in` | Check in a race entry |
| PUT | `/api/race-entries/:id/boarding` | Board a race entry |
| PUT | `/api/race-entries/:id/departure` | Mark race entry departed |
| PUT | `/api/race-entries/:id/arrival` | Record arrival and recalculate ranks |
| DELETE | `/api/race-entries/:id` | Archive race entry |

## Racing Model Notes

Racing models and routes are wired:

- `Races`: race event and departure details
- `RaceEntries`: individual bird booking, check-in, boarding, departure, arrival, virtual speed, virtual distance, and rank

Current domain boundary:

- `Affiliations`: user membership in a club
- `RaceEntries`: details of a bird entry in a race, including station details
- `Lofts`: home/arrival base
