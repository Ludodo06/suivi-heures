# Suivi d'heures

Personal app to track my working hours, on my phone and on my computer.

It is a PWA (Progressive Web App): a web page that installs like an app on the phone.
It uses plain HTML, CSS and JavaScript. There is nothing to install and nothing to build.

## Run it on the computer

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Files

- `index.html`: the page.
- `css/styles.css`: the look of the page.
- `js/app.js`: the page logic (buttons and display).
- `js/time.js`: date and duration calculations.
- `js/storage.js`: where the sessions are saved. Only this file knows how.
- `sw.js`: the service worker. It lets the app open without a network.
- `manifest.webmanifest` and `icons/`: the name and the icon of the installed app.
