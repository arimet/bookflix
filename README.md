# Bookflix

Read your ebooks and manga straight from your Dropbox, with a Netflix-style library, on iPhone, iPad and Mac.
Reading positions follow you from one device to another, for each reader of the household.

Bookflix is a static web app (PWA): no server, no account to create, nothing stored anywhere but in your own Dropbox.
Each person deploys their own copy in a few minutes on GitHub Pages.

## Features

- **Formats**: EPUB, CBZ, CBR and PDF, rendered with [prose](https://github.com/mbret/prose-reader).
- **Netflix-style library**: a poster for the book you are reading, rows (Continue reading, Downloaded, Recently added,
  Comics & manga, Books), a series sheet listing volumes like episodes, search.
- **Synced progress**: open a book on your Mac, pick it up on your iPhone at the same page.
- **Profiles**: "Who's reading?" screen, one reading history per person, avatars, optional PIN per profile.
- **Book requests**: search a book (Google Books, BnF catalogue, Open Library), ask for it; an admin profile follows
  the requests, and a request turns "available" by itself once the book lands in the library.
- **Your books stay untouched**: the app that reads your library has **read-only** access to Dropbox.
- **Offline**: download a few volumes to read without network; the app itself works offline once installed.
- **Reader settings**: one page in a centred column, adjustable width and line height, dark / sepia / light theme,
  right-to-left reading for manga (per book).
- **Installable**: add it to the iPhone home screen or to the Mac Dock like a native app.

## How it works

Bookflix uses **two Dropbox apps**, so that it can never write next to your books:

| App | Access | What it does |
| --- | --- | --- |
| **Library** | Full Dropbox, **read-only** | Lists and reads the books in your library folder (`/Ebook` by default). |
| **Sync** | Its own App folder, read and write | Stores profiles, reading progress, per-book settings and covers in `Apps/<your sync app>/`. |

Both use OAuth 2 with PKCE: no secret is involved, and the app keys are public by design (they ship in the
JavaScript of any web app). Without a sign-in to your Dropbox account, the keys give access to nothing.

## Library layout

Put your books under one Dropbox folder (`/Ebook` by default). Any layout works:

```
Ebook/
  Mangas/
    Boruto/Tome 01.cbz          ← every folder holding books is a series
    Boruto/Tome 02.cbz
  Romans/Dune.epub
  Hypérion.pdf                  ← a book at the root is a series of its own
```

A series counts as "Comics & manga" when most of its files are CBZ/CBR, otherwise as "Books".
Volumes are sorted naturally (`Tome 2` before `Tome 10`).

## Deploy your own

You need a GitHub account and a Dropbox account. Count 10 minutes.

### 1. Fork this repository

Fork it on GitHub. Your copy will be served at `https://<your-user>.github.io/<repo-name>/`
(below, `<site>` stands for that address, e.g. `https://jane.github.io/bookflix/`).

### 2. Create the two Dropbox apps

In the [Dropbox App Console](https://www.dropbox.com/developers/apps), click **Create app** twice.

**Library app**

1. Choose **Scoped access**, then **Full Dropbox**, and give it a name (e.g. `Bookflix`).
2. **Permissions** tab: tick only `files.metadata.read` and `files.content.read`, then **Submit**.
3. **Settings** tab: under **Redirect URIs**, add `<site>` (and `http://localhost:5173/bookflix/` for local development).
   Check that **Allow public clients (Implicit Grant & PKCE)** is set to **Allow**.
4. Copy the **App key**.

**Sync app**

1. Choose **Scoped access**, then **App folder**, and give it a name (e.g. `Bookflix Sync`).
2. **Permissions** tab: tick `files.metadata.read`, `files.content.read` and `files.content.write`, then **Submit**.
3. **Settings** tab: add the same redirect URIs and check **Allow public clients**.
4. Copy the **App key**.

### 3. Set the repository variables

In your fork, open **Settings › Secrets and variables › Actions › Variables** and add:

| Variable | Value |
| --- | --- |
| `VITE_DROPBOX_LIBRARY_KEY` | App key of the Library app |
| `VITE_DROPBOX_SYNC_KEY` | App key of the Sync app |
| `VITE_LIBRARY_ROOT` | *(optional)* your books folder, e.g. `/Livres`. Defaults to `/Ebook`. |
| `VITE_GOOGLE_BOOKS_KEY` | *(optional)* Google Books API key for the book search of the "Demandes" tab (see below). |

**Google Books key (optional, recommended).** Book requests search the BnF catalogue and Open Library without a
key; Google Books gives the best results but its keyless quota is shared and often exhausted. In the
[Google Cloud console](https://console.cloud.google.com/): create a project, enable **Books API**, create an
**API key**, then restrict it to **Websites** `<site>*` (and `http://localhost:5173/*`) and to the **Books API** only.
A key restricted this way can safely ship in the page.

### 4. Turn on GitHub Pages

**Settings › Pages › Build and deployment › Source**: select **GitHub Actions**.
Then run the **Deploy** workflow from the **Actions** tab (or push any commit). After about a minute the app is live at `<site>`.

### 5. Install it

- **iPhone / iPad**: open `<site>` in Safari, then **Share › Add to Home Screen**.
- **Mac**: open `<site>` in Safari, then **File › Add to Dock** (or install it from Chrome's address bar).

Open the installed app, connect **1. Your library** then **2. Sync**, create your profile and start reading.
If the Dropbox sign-in does not come back to the installed iPhone app, use **"Se connecter avec un code"**:
Dropbox shows a code that you paste into the app.

## Who can sign in

While your Dropbox apps are in **Development** status (the default), **only your own Dropbox account** can connect to
them. Someone who finds your site's address gets an error at the Dropbox sign-in and sees nothing of yours.

- **Household sharing one Dropbox account**: create one profile per reader. A profile PIN keeps readers apart, but it
  is not a security boundary: anyone signed in to that Dropbox can read the sync files.
- **Other people with their own Dropbox**: the simplest is that they deploy their own copy. You can also click
  **Enable additional users** in the Dropbox App Console; each person then connects their own Dropbox and only sees
  their own books.

## Local development

Requires Node.js 22 or later.

```bash
npm install
cp .env.example .env   # then fill in your two app keys
npm run dev            # http://localhost:5173/bookflix/
npm test
```

`npm run build` produces the static site in `dist/`. Set `BASE_PATH` (e.g. `BASE_PATH=/ npm run build`) to serve it
from another path than `/bookflix/`, and add the matching redirect URI to both Dropbox apps.

### Project layout

| Path | Role |
| --- | --- |
| `src/dropbox/` | PKCE sign-in for the two apps, Dropbox HTTP API (listing with cursor, byte-range downloads). |
| `src/library/` | Folder tree, series, rows, search, reading history. |
| `src/sync/` | Profiles, reading progress (newest position wins on merge), per-book settings. |
| `src/reader/` | prose-reader setup: EPUB through the service worker, CBZ read by byte ranges, CBR and PDF in the page. |
| `src/covers/` | Cover extraction, cached in the Sync folder so each book is processed once for all devices. |
| `src/sw.ts` | Service worker: app shell precache and EPUB streaming. |
| `src/screens/`, `src/components/` | The interface (React, Chakra UI). |

## Credits

- [prose](https://github.com/mbret/prose-reader) by Maxime Bret, the reading engine.
- [libarchive.js](https://github.com/nika-begiashvili/libarchivejs) for CBR, [pdf.js](https://mozilla.github.io/pdf.js/) for PDF,
  [zip.js](https://gildas-lormeau.github.io/zip.js/) for range reading.

Bookflix is not affiliated with Netflix or Dropbox.

## License

[MIT](LICENSE)
