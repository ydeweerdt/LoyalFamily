# UX improvement

## Scrolling
When scrolling through the tiles, the title bar should fixed at the top of the screen.
No borders there.

## Menu
Hide the Admin/Settings/Sign out behind some button with an appropriate icon.

## Card addition
After selecting the plus sign, show the list of known brands, when brand is selected immediately activate the barcode scanner.
Then there are 3 options:
* scan a barcode
* press the button "Manual"
* press the arrow to go back and abort card addition

Once the barcode is scanned you end up in the Add Card dialog, where you can edit details, confirm or abort the addition of the card.

## General look and feel
Make GUI more resemble Catima gui.
Nice icons like +, pencil for edit, back arrow instead of close button, garbage can in stead of delete button
see screenshots at https://play.google.com/store/apps/details?id=me.hackerchick.catima&pli=1

## Localization
Can the native language of the phone be detected and the app language modified accordingly?

**Done** — `src/lib/i18n.svelte.ts`: en/nl, auto-detected from the browser/phone
language, override in Settings (Auto / Nederlands / English), e2e spec 07.
Remaining: more languages (fr/de) would need a translator, and the brand catalog is
Belgian-only either way.

# Brand logos
## Known brand logos
Incorporate the logos of the known brands, not only text.

## Uploading unknown brand logo
For "Other brand" allow uploading an brand image.

Constraint before this can be built: the image must live **in the database (BLOB)**
or be bundled in the image — never as a file under `DATA_DIR`. "Backup = copy one
SQLite file" is a v0.1 promise (REQUIREMENTS §10) and uploaded files on disk break
it. Uploaded logos also need a size/format limit and re-encoding (downscale, strip
EXIF). See REQUIREMENTS §14.

