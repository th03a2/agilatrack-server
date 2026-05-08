# AgilaTrack Server

Express and MongoDB API for AgilaTrack club, loft, affiliation, officer, and racing data.

Commerce backend files are grouped in `server/commerce` so they are easier to find.

## Setup

Create `server/.env` from the example file:

```env
MONGO_URI=your_mongodb_connection_string
PORT=5000
HOST=0.0.0.0
```

Install dependencies and run the API:

```bash
npm install
npm run dev
```

For teammates cloning the project:

1. Run `npm install` inside the `server` folder.
2. Copy `server/.env.example` to `server/.env`.
3. Replace `MONGO_URI` with the shared MongoDB Atlas connection string.
4. In MongoDB Atlas, add their current public IP address under **Network Access**.
5. Start the backend with `npm run dev`.

If the backend works on one computer but not another, the most common causes are:

- `server/.env` is missing because `.env` is intentionally ignored by Git.
- The teammate's IP address is not allowed in MongoDB Atlas Network Access.
- The Atlas database username or password is different from the connection string.
- Port `5000` is already in use on their machine.
- The API is only listening on `localhost`; for phones on the same Wi-Fi, keep `HOST=0.0.0.0`.

## Seed Data

The seeder creates a realistic Philippine racing bird sample network:

- National federation: Philippine Homing Pigeon Racing Federation
- Regional councils: CALABARZON and Central Luzon
- Provincial associations: Cavite, Laguna, and Tarlac
- Municipality clubs: Indang, Silang, Calamba, and Tarlac City
- Users, affiliations, lofts, and officers
- Bird profiles, ownership, pedigree, and health records
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
| GET | `/nbi/routes` | List available NBI routes |

Clubs:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/nbi/clubs` | List clubs |
| GET | `/nbi/clubs/meta/levels` | List club hierarchy levels |
| GET | `/nbi/clubs/pyramid` | Fetch full club pyramid |
| GET | `/nbi/clubs/:id/tree` | Fetch club subtree |
| GET | `/nbi/clubs/:id/children` | Fetch direct child clubs |
| GET | `/nbi/clubs/:id` | Fetch one club |
| POST | `/nbi/clubs` | Create club |
| PUT | `/nbi/clubs/:id` | Update club |
| DELETE | `/nbi/clubs/:id` | Archive club |

Lofts:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/nbi/lofts` | List lofts |
| GET | `/nbi/lofts/:id` | Fetch one loft |
| POST | `/nbi/lofts` | Create loft |
| PUT | `/nbi/lofts/:id` | Update loft |
| DELETE | `/nbi/lofts/:id` | Archive loft |

Birds:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/nbi/birds` | List birds |
| GET | `/nbi/birds/:id` | Fetch one bird |
| POST | `/nbi/birds` | Create bird |
| PUT | `/nbi/birds/:id` | Update bird |
| DELETE | `/nbi/birds/:id` | Archive bird |
| ANY | `/nbi/pigeons/*` | Legacy alias for `/nbi/birds/*` |

Users:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/nbi/users` | List users |
| GET | `/nbi/users/:id` | Fetch one user |
| POST | `/nbi/users` | Create user |
| PUT | `/nbi/users/:id` | Update user |
| DELETE | `/nbi/users/:id` | Deactivate user |

Affiliations:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/nbi/affiliations` | List affiliations |
| GET | `/nbi/affiliations/:id` | Fetch one affiliation |
| POST | `/nbi/affiliations` | Create affiliation |
| PUT | `/nbi/affiliations/:id` | Update affiliation |
| DELETE | `/nbi/affiliations/:id` | Archive affiliation |

Officers:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/nbi/officers` | List officers |
| GET | `/nbi/officers/:id` | Fetch one officer |
| POST | `/nbi/officers` | Create officer |
| PUT | `/nbi/officers/:id` | Update officer |
| DELETE | `/nbi/officers/:id` | Archive officer |

Races:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/nbi/races` | List races |
| GET | `/nbi/races/:id` | Fetch one race |
| POST | `/nbi/races` | Create race |
| PUT | `/nbi/races/:id` | Update race |
| DELETE | `/nbi/races/:id` | Archive race |

Race entries:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/nbi/race-entries` | List race entries |
| GET | `/nbi/race-entries/:id` | Fetch one race entry |
| POST | `/nbi/race-entries` | Book a race entry |
| PUT | `/nbi/race-entries/:id` | Update race entry |
| PUT | `/nbi/race-entries/:id/check-in` | Check in a race entry |
| PUT | `/nbi/race-entries/:id/boarding` | Board a race entry |
| PUT | `/nbi/race-entries/:id/departure` | Mark race entry departed |
| PUT | `/nbi/race-entries/:id/arrival` | Record arrival and recalculate ranks |
| DELETE | `/nbi/race-entries/:id` | Archive race entry |

Commerce:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/nbi/commerce` | Commerce module summary |
| GET | `/nbi/commerce/wallets` | List commerce wallets |
| GET | `/nbi/commerce/wallets/:walletId` | Fetch one commerce wallet |
| POST | `/nbi/commerce/wallets` | Create coordinator or fancier wallet |
| PUT | `/nbi/commerce/wallets/:walletId/preload` | Preload wallet balance |
| PUT | `/nbi/commerce/wallets/:walletId/transfer` | Transfer load between wallets |
| PUT | `/nbi/commerce/wallets/:walletId/fees/bird-registration` | Charge bird registration fee |
| PUT | `/nbi/commerce/wallets/:walletId/fees/race` | Charge race fee |
| POST | `/nbi/commerce/wallets/:walletId/recharge-requests` | Create recharge request |
| PUT | `/nbi/commerce/wallets/:walletId/recharge-requests/:transactionId/approve` | Approve recharge request |
| PUT | `/nbi/commerce/wallets/:walletId/recharge-requests/:transactionId/reject` | Reject recharge request |
| GET | `/nbi/commerce/fee-profiles` | List fee profiles |
| POST | `/nbi/commerce/fee-profiles` | Save fee profile by club and fee type |
| GET | `/nbi/commerce/receipts` | List issued receipts |
| GET | `/nbi/commerce/receipts/:receiptId` | Fetch one receipt |

## Racing Model Notes

Racing models and routes are wired:

- `Races`: race event and departure details
- `RaceEntries`: individual bird booking, check-in, boarding, departure, arrival, virtual speed, virtual distance, and rank

Current domain boundary:

- `Affiliations`: user membership in a club
- `RaceEntries`: details of a bird entry in a race, including station details
- `Lofts`: home/arrival base
