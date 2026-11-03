<p align="center">
  <img src="public/icon.svg" width="112" alt="" />
</p>

<h1 align="center">Bookflix</h1>

<p align="center">
  Your ebooks and manga, straight from your Dropbox, in a Netflix-style library.<br />
  On iPhone, iPad and Mac. Your place in each book follows you from one device to the next.
</p>

<p align="center">
  <a href="https://arimet.github.io/bookflix/"><b>Open Bookflix</b></a> ·
  <a href="#features">Features</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#host-your-own-copy">Host your own copy</a> ·
  <a href="#local-development">Development</a>
</p>

---

Bookflix is a static web app that you install on your home screen. There is no server and no account to create:
it reads your books from a Dropbox folder, and keeps everything it needs (profiles, reading positions, covers)
in a small folder of that same Dropbox.

## Use Bookflix

1. Open **https://arimet.github.io/bookflix/**.
2. Tap **Se connecter à Dropbox** and accept the two Dropbox screens: one lets Bookflix read your books (it can never
   change them), the other gives it a folder of its own for profiles and reading positions.
3. Pick the folder that holds your books, create a profile, and read.

To install it: in Safari on iPhone or iPad, **Share › Add to Home Screen**; on a Mac, **File › Add to Dock** in Safari,
or the install button in Chrome's address bar. See the [privacy page](https://arimet.github.io/bookflix/confidentialite.html)
for what Bookflix reads and writes.

## Features

**Library**
- Reads **EPUB, CBZ, CBR and PDF**.
- A Netflix home page: the book you are reading as a poster, then rows (Continue reading, Downloaded, Recently added,
  Comics & manga, Books).
- Each folder is a series; its sheet lists the volumes like episodes.
- Search by folder or author (shows their series) or by book title (shows the book).
- A coloured cover for books that have none.

**Reading**
- One page in a centred column; width, line height and theme (dark, sepia, light) are adjustable.
- Right-to-left reading for manga, set per book.
- Comics not on the device are read page by page from Dropbox, without waiting for the whole file.
- Download volumes to read offline; the app itself works offline once installed.

**Household**
- A "Who's reading?" screen, one reading history per person, avatars and an optional PIN.
- Long press a book (or right click) to start it over or remove its download.

**Book requests**
- Search any book (Google Books, falling back on the BnF catalogue and Open Library) and ask for it.
- An admin profile follows the requests; a request turns *Available* by itself once the book lands in the library.

## How it works

```
 Dropbox
 ├── Ebook/                  ← your books, read-only for Bookflix
 │   ├── Batman/
 │   │   ├── One-Shot/…cbz
 │   │   └── White Knight/…cbz
 │   └── Dune.epub
 └── Apps/Bookflix Sync/     ← Bookflix's own folder
     └── profiles, reading positions, covers, requests
```

Bookflix connects to Dropbox through **two Dropbox apps**, so that it can never write next to your books:

| App | Access | Used for |
| --- | --- | --- |
| **Library** | Whole Dropbox, **read-only** | Listing and reading the books in the folder each household picks. |
| **Sync** | Its own app folder, read and write | Profiles, reading positions, per-book settings, covers, requests and the chosen books folder. |

Sign-in uses OAuth 2 with PKCE: there is no secret. The app keys ship in the page like in any web app, and they give
access to nothing without a sign-in to your Dropbox account.

### Library layout

Any layout works. Every folder holding books is a series, and a book alone at the root is a series of its own.

| In Dropbox | Shown as |
| --- | --- |
| `Ebook/Naruto/Tome 01.cbz`, `Tome 02.cbz`… | **Naruto**, volumes sorted naturally (`Tome 2` before `Tome 10`) |
| `Ebook/Batman/One-Shot/…` | **Batman · One-Shot**: a sub-folder carries its parent's name… |
| `Ebook/Batman/Batman - Snyder/…` | **Batman - Snyder**: …unless its name already holds it |
| `Ebook/Dune.epub` | **Dune** |

A series goes to *Comics & manga* when most of its files are CBZ or CBR, otherwise to *Books*.

## Host your own copy

Only if you want your own instance: anyone can use the shared site above. You need a GitHub account and a Dropbox
account. Count ten minutes.

### 1. Fork this repository

Your copy will be served at `https://<your-user>.github.io/<repo-name>/`. Below, `<site>` stands for that
address, e.g. `https://jane.github.io/bookflix/`.

### 2. Create the two Dropbox apps

In the [Dropbox App Console](https://www.dropbox.com/developers/apps), click **Create app** twice:

| | Library app | Sync app |
| --- | --- | --- |
| Type | **Scoped access**, **Full Dropbox** | **Scoped access**, **App folder** |
| Name | e.g. `Bookflix` | e.g. `Bookflix Sync` |
| Permissions tab | `files.metadata.read`, `files.content.read` | `files.metadata.read`, `files.content.read`, `files.content.write` |

Then, for **both** apps, in the **Settings** tab:
- under **Redirect URIs**, add `<site>` (and `http://localhost:5173/bookflix/` for local development);
- check that **Allow public clients (Implicit Grant & PKCE)** is set to **Allow**;
- copy the **App key**.

### 3. Set the repository variables

In your fork: **Settings › Secrets and variables › Actions › Variables**.

| Variable | Value |
| --- | --- |
| `VITE_DROPBOX_LIBRARY_KEY` | App key of the Library app |
| `VITE_DROPBOX_SYNC_KEY` | App key of the Sync app |
| `VITE_LIBRARY_ROOT` | *Optional.* Folder taken without asking when it exists, e.g. `/Livres`. Defaults to `/Ebook`. Each household can pick another one in the app. |
| `VITE_GOOGLE_BOOKS_KEY` | *Optional, recommended.* A Google Books key for book requests (see below). |

<details>
<summary><b>Getting a Google Books key</b></summary>

Without a key, book requests search the BnF catalogue and Open Library only. With one, they search Google Books,
which gives the best results (Google's keyless quota is shared and almost always exhausted).

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project and enable the **Books API**.
2. Create an **API key**.
3. Restrict it to **Websites** `<site>*` (and `http://localhost:5173/*`), and to the **Books API** only.

A key restricted this way is safe to ship in the page.
</details>

### 4. Turn on GitHub Pages

**Settings › Pages › Build and deployment › Source**: select **GitHub Actions**. Then run the **Deploy** workflow
from the **Actions** tab, or push any commit. About a minute later the app is live at `<site>`.

### 5. Install it

- **iPhone, iPad**: open `<site>` in Safari, then **Share › Add to Home Screen**.
- **Mac**: open `<site>` in Safari, then **File › Add to Dock**, or install it from Chrome's address bar.

Open the installed app, tap **Se connecter à Dropbox**, accept the two Dropbox screens, pick your books folder, create
your profile, and read.
If the Dropbox sign-in does not come back to the installed iPhone app, use **Se connecter avec un code**: Dropbox
shows a code that you paste into the app.

## Who can sign in

Anyone with a **personal Dropbox account**. Each Dropbox sees only its own books and its own profiles; Bookflix has
no server where they could meet. Dropbox Business team folders are not supported: only the member's own folders show.

- **A household sharing one Dropbox**: create one profile per reader. A PIN keeps readers apart, but it is not a
  security boundary: anyone signed in to that Dropbox can read the sync folder. Only the admin profile can change
  the books folder.
- **Your own copy**: while your Dropbox apps are in **Development** status, only your account can connect. Click
  **Enable additional users** in the Dropbox App Console to let up to 500 accounts in; past 50, Dropbox asks you to
  apply for **Production** status, which needs a privacy policy (`public/confidentialite.html`).

## Local development

Requires Node.js 22 or later.

```bash
npm install
cp .env.example .env   # fill in your two app keys
npm run dev            # http://localhost:5173/bookflix/
npm test
```

`npm run build` writes the static site to `dist/`. To serve it from another path than `/bookflix/`, set
`BASE_PATH` (e.g. `BASE_PATH=/ npm run build`) and add the matching redirect URI to both Dropbox apps.

| Path | Role |
| --- | --- |
| `src/dropbox/` | PKCE sign-in for the two apps, Dropbox API calls (listing with a cursor, byte-range downloads). |
| `src/library/` | Folder tree, series, rows, search, reading history. |
| `src/sync/` | Profiles, reading positions (the newest wins on merge), per-book settings. |
| `src/reader/` | Reader setup: EPUB through the service worker, CBZ by byte ranges, CBR and PDF in the page. |
| `src/covers/` | Cover extraction, cached in the Sync folder so each book is processed once for all devices. |
| `src/requests/` | Book search and the shared request list. |
| `src/screens/`, `src/components/` | The interface (React, Chakra UI). |
| `src/sw.ts` | Service worker: offline app shell and EPUB streaming. |

## Credits

- [prose](https://github.com/mbret/prose-reader) by Maxime Bret, the reading engine.
- [libarchive.js](https://github.com/nika-begiashvili/libarchivejs) for CBR, [pdf.js](https://mozilla.github.io/pdf.js/)
  for PDF, [zip.js](https://gildas-lormeau.github.io/zip.js/) for range reading.
- Book data from [Google Books](https://books.google.com/), the [BnF catalogue](https://catalogue.bnf.fr/) and
  [Open Library](https://openlibrary.org/).

Bookflix is not affiliated with Netflix or Dropbox.

## License

[MIT](LICENSE)
