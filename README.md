# Suivi d'heures

Personal app to track my working hours, on my phone and on my computer.

It is a PWA (Progressive Web App): a web page that installs like an app on the phone.
It uses plain HTML, CSS and JavaScript. There is nothing to install and nothing to build.

## Run it on the computer

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Features

- A timer with pauses and an explicit end of the day, with a progress ring.
- The work and the pauses of each day, on a timeline, and the planned end of the day.
- An hour bank: the time above or below the daily target.
- Hours and notes that can be corrected afterwards, for any day.
- A calendar with the vacation days and the public holidays of the canton of Vaud.
- Holidays that can be added or removed, for a full day or a half day.
- Statistics: averages, records, weekly hours, bank evolution and a year heatmap.
- An Excel export of a month or a year, and a backup file.
- Example data, to try the app: add `?demo=1` to the address.

## Accounts and data

Firebase keeps the data of each profile, and syncs the phone and the computer.

- A profile is a name and a password. Firebase Authentication receives them as an e-mail address built
  from the name. No e-mail is ever sent, so a forgotten password cannot be recovered.
- Creating a profile needs an invite code. Each code is a document in the `invites` collection of
  Firestore, and nobody can read that collection from the app.
- `firestore.rules` holds the security rules. Paste them in the Firebase console after each change.
- The values in `js/firebase-config.js` are public by design. The security rules protect the data.

## Tests

Start the local server, then open http://localhost:8000/tests/.

## Files

- `index.html`: the page.
- `css/styles.css`: the look of the page.
- `js/app.js`: starts the app and connects the screens.
- `js/views/`: one file for each screen, and the window that edits a day.
- `js/charts.js`: the charts, in plain SVG and HTML.
- `js/calculator.js`: the totals of a day, the hour bank and the vacation count.
- `js/insights.js`: the averages, the records and the next events.
- `js/holidays.js`: the public holidays of the canton of Vaud.
- `js/time.js`: date and duration helpers.
- `js/export.js` and `js/xlsx.js`: the Excel export.
- `js/demo.js`: the example data.
- `js/dom.js` and `js/icons.js`: small page helpers and the icons.
- `js/storage.js`: the profiles, and where the data is saved. Only this file knows how.
- `js/firebase-config.js`: the public address of the Firebase project.
- `js/views/login.js`: the sign-in screen.
- `firestore.rules`: the security rules of the data.
- `sw.js`: the service worker. It lets the app open without a network.
- `manifest.webmanifest` and `icons/`: the name and the icon of the installed app.
