# Commerce Module

This folder contains the dedicated backend commerce module for AgilaTrack.

## Location

- `server/commerce/models`
- `server/commerce/controllers`
- `server/commerce/routes.js`

## What It Handles

- Coordinator and fancier wallets
- Coordinator preload and wallet funding
- Fancier load requests and coordinator transfer flow
- Bird registration fees with classification-based fee matrix
- Race fees with club fee matrix
- Recharge requests with approve/reject workflow
- Receipt issuance with receipt and transaction reference numbers

## Main Route Base

```txt
/api/commerce
```

## Main Endpoints

### Wallets

- `GET /api/commerce/wallets`
- `GET /api/commerce/wallets/:walletId`
- `POST /api/commerce/wallets`
- `PUT /api/commerce/wallets/:walletId`
- `PUT /api/commerce/wallets/:walletId/preload`
- `PUT /api/commerce/wallets/:walletId/transfer`
- `PUT /api/commerce/wallets/:walletId/fees/bird-registration`
- `PUT /api/commerce/wallets/:walletId/fees/race`
- `POST /api/commerce/wallets/:walletId/recharge-requests`
- `PUT /api/commerce/wallets/:walletId/recharge-requests/:transactionId/approve`
- `PUT /api/commerce/wallets/:walletId/recharge-requests/:transactionId/reject`

### Fee Profiles

- `GET /api/commerce/fee-profiles`
- `POST /api/commerce/fee-profiles`

### Receipts

- `GET /api/commerce/receipts`
- `GET /api/commerce/receipts/:receiptId`

## Suggested Setup

Create fee profiles first per club:

```json
{
  "club": "CLUB_ID",
  "feeType": "bird_registration",
  "defaultAmount": 50,
  "rules": [
    { "classification": "local", "amount": 50 },
    { "classification": "imported", "amount": 100 }
  ]
}
```

Then create wallets for coordinators and fanciers.
