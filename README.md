# TonerMatch — Version 1

TonerMatch is a static GitHub Pages demo that helps a shopper enter a Brother printer model, see compatible toner cartridges and open a matching eBay Canada search.

## What is included

- Responsive homepage and results view
- Search that ignores spaces, hyphens and capitalization
- Mouse and keyboard autocomplete
- 40 popular Brother printer models
- Printer-to-toner compatibility data
- Toner colour, yield type and approximate page yield
- Four sample recommendation cards
- Live eBay Canada search links
- No dependencies, build tools, database or secret keys

The displayed prices and cost-per-page figures are clearly marked sample data. Version 1 does not call the eBay API.

## Put it on GitHub Pages

1. Create a new public GitHub repository, for example `tonermatch`.
2. Upload every file and folder from this package to the repository root.
3. Commit the files to the `main` branch.
4. Open **Settings → Pages** in the repository.
5. Under **Build and deployment**, select **Deploy from a branch**.
6. Choose the `main` branch and the `/ (root)` folder, then save.

GitHub will publish the site at a URL similar to:

`https://YOUR-USERNAME.github.io/tonermatch/`

## Preview it on your computer

Because the page loads JSON files, opening `index.html` directly with a `file://` address is not enough. From inside this folder, run either:

```bash
python3 -m http.server 8000
```

or:

```bash
npx serve .
```

Then open `http://localhost:8000` in your browser.

## Important security rule

Never add any of these values to this public repository:

- eBay Client Secret / Cert ID
- OAuth access tokens
- OAuth refresh tokens
- `.env` files containing credentials

Version 2 should use a small backend or serverless function to hold eBay credentials and make Browse API requests securely.

## Editing the catalog

Update the files inside `data/`:

- Add a printer to `printers.json`.
- Add a toner SKU to `toners.json` if it does not already exist.
- Add the printer-to-toner relationship to `compatibility.json`.

Every `printer_id` and `toner_id` used in `compatibility.json` must match an ID in the other two files.

## License

This demo source is available under the MIT License. Product names and trademarks belong to their respective owners.
