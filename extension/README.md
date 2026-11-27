# WILSY Apply Helper (Chrome extension)

Fills your saved name, email, phone, city, current company and links into the empty fields of a job
application form, when you click **Fill this form**. It never presses Submit, never uploads files and never
answers questions: you check every field, attach your resume, answer the questions and submit yourself.

- Permissions: `activeTab` (only the tab you click it on, only when you click), `scripting` and `storage`.
  No access to any site until you click; nothing runs in the background.
- Your details stay in Chrome's extension storage on your computer. Nothing is sent to WILSY.
- Fields about other people (referrer, emergency contact, school, hiring manager) and sensitive questions
  (salary, notice period, visa, gender, date of birth, cover letter, "why") are left alone.
- Checked against Greenhouse, Lever and Ashby style forms; other forms fill whatever matches.

Ideas from applyai and JobNavigator (both MIT). No code copied.

## Try it

1. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick this `extension` folder.
2. Click the WILSY icon → **Edit my details**, fill them in, **Save**.
3. Open an application form, click the WILSY icon → **Fill this form**.

## Publishing

Listing it on the Chrome Web Store needs a developer account (one-time US$5) made by the WILSY owner.
Zip this folder (without `tests/` and this README) and upload it there.

## Tests

`node --test extension/tests/*.test.mjs` (also part of `npm test`).
