# Mechanic avatar images

Drop mechanic profile pictures here to have them shown on the driver's
"Mechanic Assigned" card when a provider has **no** uploaded `profile_photo_url`.

## How the card chooses a picture (in order)
1. The mechanic's real uploaded photo (`profile_photo_url` from the backend).
2. A stock picture from this folder, picked deterministically by the mechanic's
   id: `mechanic-1.jpg`, `mechanic-2.jpg`, … `mechanic-6.jpg`.
   (Each mechanic id always maps to the same file, so it looks stable.)
3. `default.svg` (always present — a generic avatar).
4. The mechanic's initials, if every image fails to load.

## To add your pictures
- Name them `mechanic-1.jpg` … `mechanic-6.jpg` (`.jpg`, `.jpeg`, or `.png` —
  if you use a different extension, update `DEFAULT_AVATAR_COUNT` / the path in
  `src/components/MechanicAssignedCard.tsx`).
- Square images (e.g. 320×320) look best — they're rendered in a circle.
- Want more or fewer than 6? Change `DEFAULT_AVATAR_COUNT` in the same file.
