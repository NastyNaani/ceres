# Ceres

**Know what you buy.** Scan a food barcode and get a clear Elite → Rough
verdict from Open Food Facts data (Nutri-Score, NOVA, additives), with USDA
FoodData Central as a fallback when OFF misses.

Sister aesthetic to [Argent](../QR%20Scanner) — same dark-luxury UI language,
separate Expo app and package id.

## Features

- Live barcode scan (EAN/UPC and common 1D formats)
- Open Food Facts lookup — name, brand, image, Nutri-Score, NOVA, ingredients
- USDA FoodData Central fallback for barcodes OFF misses
- Transparent scoring (not a black-box proprietary grade)
- On-device history with favorites, search, export/import
- No account, no ads in this build

## Stack

- Expo SDK 56 · React Native · expo-router · TypeScript
- Orbitron + Manrope via `@expo-google-fonts`

## Run

```bash
cd E:\Ceres
npm install
cp .env.example .env   # set USDA_API_KEY for the server proxy
npm test
npx expo start
```

USDA lookups go through `app/api/usda+api.ts`. Put `USDA_API_KEY` in `.env` / EAS
secrets only — never `EXPO_PUBLIC_*`.

## Privacy

Barcode digits are sent to Open Food Facts when looking up a product. History
and settings stay on device. See in-app **Settings → Privacy**.

## License

Private / TBD — not published yet.
