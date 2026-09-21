# Ceres

**Know what you buy.** Scan a food barcode and get a clear Good / Okay / Poor
verdict from Open Food Facts data (Nutri-Score, NOVA, additives).

Sister aesthetic to [Argent](../QR%20Scanner) — same dark-luxury UI language,
separate Expo app and package id.

## Features

- Live barcode scan (EAN/UPC and common 1D formats)
- Open Food Facts lookup — name, brand, image, Nutri-Score, NOVA, ingredients
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
npx expo start
```

## Privacy

Barcode digits are sent to Open Food Facts when looking up a product. History
and settings stay on device. See in-app **Settings → Privacy**.

## License

Private / TBD — not published yet.
