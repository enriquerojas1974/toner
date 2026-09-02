const DATA_FILES = {
  printers: "data/printers.json",
  toners: "data/toners.json",
  compatibility: "data/compatibility.json"
};

const state = {
  printers: [],
  toners: [],
  compatibility: new Map(),
  suggestions: [],
  activeSuggestion: -1
};

const elements = {
  form: document.querySelector("#printer-form"),
  input: document.querySelector("#printer-input"),
  suggestions: document.querySelector("#suggestions"),
  error: document.querySelector("#search-error"),
  results: document.querySelector("#results"),
  empty: document.querySelector("#empty-state"),
  printerName: document.querySelector("#printer-name"),
  tonerSummary: document.querySelector("#toner-summary"),
  dealGrid: document.querySelector("#deal-grid")
};

function normalize(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadCatalog() {
  try {
    const responses = await Promise.all(
      Object.values(DATA_FILES).map((url) => fetch(url))
    );

    if (responses.some((response) => !response.ok)) {
      throw new Error("One or more data files could not be loaded.");
    }

    const [printers, toners, compatibility] = await Promise.all(
      responses.map((response) => response.json())
    );

    state.printers = printers.sort((a, b) => b.launch_priority - a.launch_priority);
    state.toners = toners;
    state.compatibility = new Map(
      compatibility.map((entry) => [entry.printer_id, entry.toner_ids])
    );

    restorePrinterFromUrl();
  } catch (error) {
    showError(
      location.protocol === "file:"
        ? "This site needs to be served by GitHub Pages or a local web server. See README.md for the one-line preview command."
        : "The printer catalog could not be loaded. Check that the data folder was uploaded with the site."
    );
    elements.input.disabled = true;
    elements.form.querySelector("button").disabled = true;
  }
}

function findMatches(rawQuery) {
  const query = normalize(rawQuery);
  if (!query) return [];

  return state.printers
    .map((printer) => {
      const model = printer.normalized_model;
      let score = 0;
      if (model === query) score = 100;
      else if (model.startsWith(query)) score = 80;
      else if (model.includes(query)) score = 60;
      else if (`BROTHER${model}`.includes(query)) score = 40;
      return { printer, score };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || b.printer.launch_priority - a.printer.launch_priority)
    .slice(0, 7)
    .map((match) => match.printer);
}

function showSuggestions(matches) {
  state.suggestions = matches;
  state.activeSuggestion = -1;

  if (!matches.length) {
    hideSuggestions();
    return;
  }

  elements.suggestions.innerHTML = matches
    .map(
      (printer, index) => `
        <li role="option" id="suggestion-${index}">
          <button type="button" data-index="${index}" aria-selected="false">
            <span class="suggestion-brand">${escapeHtml(printer.brand)}</span>
            <span class="suggestion-model">${escapeHtml(printer.model)}</span>
          </button>
        </li>`
    )
    .join("");

  elements.suggestions.hidden = false;
  elements.input.setAttribute("aria-expanded", "true");
}

function hideSuggestions() {
  elements.suggestions.hidden = true;
  elements.input.setAttribute("aria-expanded", "false");
  elements.input.removeAttribute("aria-activedescendant");
  state.activeSuggestion = -1;
}

function updateActiveSuggestion(nextIndex) {
  if (!state.suggestions.length) return;

  state.activeSuggestion = (nextIndex + state.suggestions.length) % state.suggestions.length;
  const buttons = [...elements.suggestions.querySelectorAll("button")];
  buttons.forEach((button, index) => {
    button.setAttribute("aria-selected", String(index === state.activeSuggestion));
  });
  elements.input.setAttribute("aria-activedescendant", `suggestion-${state.activeSuggestion}`);
  buttons[state.activeSuggestion]?.scrollIntoView({ block: "nearest" });
}

function selectPrinter(printer, updateUrl = true) {
  const tonerIds = state.compatibility.get(printer.id) || [];
  const toners = tonerIds
    .map((id) => state.toners.find((toner) => toner.id === id))
    .filter(Boolean);

  elements.input.value = `${printer.brand} ${printer.model}`;
  elements.printerName.textContent = `${printer.brand} ${printer.model}`;
  elements.tonerSummary.innerHTML = toners.map(renderTonerCard).join("");
  elements.dealGrid.innerHTML = buildDeals(toners).map(renderDealCard).join("");
  elements.results.hidden = false;
  elements.empty.hidden = true;
  clearError();
  hideSuggestions();

  document.title = `${printer.brand} ${printer.model} toner — TonerMatch`;
  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("printer", printer.model);
    history.replaceState({}, "", url);
  }

  requestAnimationFrame(() => {
    elements.results.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderTonerCard(toner) {
  const colorMap = {
    Black: "#17202f",
    Cyan: "#08a8c7",
    Magenta: "#dc3f7c",
    Yellow: "#f7bd25"
  };
  return `
    <article class="toner-card" style="--card-color:${colorMap[toner.color] || colorMap.Black}">
      <div class="toner-sku">${escapeHtml(toner.sku)}</div>
      <p class="toner-meta">${escapeHtml(toner.color)} · ${escapeHtml(toner.yield_type)}</p>
      <div class="yield-row">
        <span>Approximate yield</span>
        <strong>${Number(toner.page_yield).toLocaleString()} pages</strong>
      </div>
    </article>`;
}

function buildDeals(toners) {
  if (!toners.length) return [];

  const blackToners = toners.filter((toner) => toner.color === "Black");
  const highestYield = [...(blackToners.length ? blackToners : toners)]
    .sort((a, b) => b.page_yield - a.page_yield)[0];
  const standard = [...(blackToners.length ? blackToners : toners)]
    .sort((a, b) => a.page_yield - b.page_yield)[0];
  const isColour = new Set(toners.map((toner) => toner.color)).size > 1;
  const familyLabel = isColour ? `${standard.family} colour set` : highestYield.sku;

  const deals = [
    {
      label: "Best OEM",
      title: `Genuine Brother ${highestYield.sku}`,
      description: `${highestYield.yield_type} · approx. ${highestYield.page_yield.toLocaleString()} pages`,
      price: isColour ? "$289.99" : "$64.99",
      note: "sample price",
      query: `genuine Brother ${highestYield.sku} toner`
    },
    {
      label: "Best value",
      title: `Compatible ${standard.sku}`,
      description: `Budget alternative for the ${standard.family} family`,
      price: isColour ? "$79.99" : "$18.99",
      note: "sample price",
      query: `compatible Brother ${standard.sku} toner`
    },
    {
      label: "Best multipack",
      title: isColour ? `${familyLabel}` : `${highestYield.sku} 2-pack`,
      description: isColour ? "Black, cyan, magenta and yellow" : "Two high-yield compatible cartridges",
      price: isColour ? "$109.99" : "$27.99",
      note: "sample price",
      query: isColour ? `Brother ${standard.family} 4 pack toner` : `Brother ${highestYield.sku} 2 pack toner`
    },
    {
      label: "Lowest cost/page",
      title: `Compatible high yield`,
      description: `Compare delivered price and seller feedback`,
      price: isColour ? "From 1.2¢" : "From 0.7¢",
      note: "sample cost per page",
      query: `compatible Brother ${highestYield.sku} high yield toner`
    }
  ];

  return deals;
}

function renderDealCard(deal) {
  const url = `https://www.ebay.ca/sch/i.html?_nkw=${encodeURIComponent(deal.query)}`;
  return `
    <article class="deal-card">
      <div class="deal-label">${escapeHtml(deal.label)}</div>
      <h3>${escapeHtml(deal.title)}</h3>
      <p class="deal-description">${escapeHtml(deal.description)}</p>
      <p class="deal-price">${escapeHtml(deal.price)}<small>${escapeHtml(deal.note)}</small></p>
      <a class="ebay-link" href="${url}" target="_blank" rel="noopener noreferrer">
        <span>Search on eBay</span><span aria-hidden="true">→</span>
      </a>
    </article>`;
}

function submitSearch() {
  const matches = findMatches(elements.input.value);
  if (!normalize(elements.input.value)) {
    showError("Enter a Brother printer model first.");
    return;
  }
  if (!matches.length) {
    showError("That model is not in the Version 1 catalog yet. Try part of the model number, such as 2710 or 2405.");
    return;
  }
  selectPrinter(matches[0]);
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = false;
}

function clearError() {
  elements.error.textContent = "";
  elements.error.hidden = true;
}

function restorePrinterFromUrl() {
  const query = new URLSearchParams(window.location.search).get("printer");
  if (!query) return;
  const match = findMatches(query)[0];
  if (match) selectPrinter(match, false);
}

elements.input.addEventListener("input", () => {
  clearError();
  showSuggestions(findMatches(elements.input.value));
});

elements.input.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    updateActiveSuggestion(state.activeSuggestion + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    updateActiveSuggestion(state.activeSuggestion - 1);
  } else if (event.key === "Enter" && state.activeSuggestion >= 0) {
    event.preventDefault();
    selectPrinter(state.suggestions[state.activeSuggestion]);
  } else if (event.key === "Escape") {
    hideSuggestions();
  }
});

elements.suggestions.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-index]");
  if (!button) return;
  selectPrinter(state.suggestions[Number(button.dataset.index)]);
});

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  submitSearch();
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".combobox-wrap")) hideSuggestions();
});

document.querySelectorAll("[data-printer]").forEach((button) => {
  button.addEventListener("click", () => {
    elements.input.value = button.dataset.printer;
    submitSearch();
  });
});

loadCatalog();
