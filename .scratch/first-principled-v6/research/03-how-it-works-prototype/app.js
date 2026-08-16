/**
 * Throwaway how-it-works chrome prototype.
 * Three variants of empty Tree + How it works + foundations word box.
 * Locked copy from grilling 2026-08-16. No dock chrome. No generator.
 */
(function () {
  const PLACEHOLDER = "A thing in reality (laptop, photosynthesis)";
  const EMPTY_LINE =
    "Type the thing you want to understand from its foundations.";
  const ARIA_WORD = "A thing in reality to understand from its foundations";
  const HOW_PARAS = [
    "This is not designed to replace reading.",
    "It is for gaining understanding of relationships between layers.",
    "It is meant to help you open your own rabbit holes. Each node is a rabbit hole for the thing you wanted to learn.",
    "Type a thing in reality and understand it from its foundations.",
  ];

  const VARIANTS = [
    { key: "A", name: "Header chrome" },
    { key: "B", name: "Canvas hero" },
    { key: "C", name: "Docked box" },
  ];

  const state = {
    word: "",
    wouldBuild: "",
  };

  function variantKey() {
    const raw = new URLSearchParams(location.search).get("variant") || "A";
    return VARIANTS.some((v) => v.key === raw) ? raw : "A";
  }

  function onHowPage() {
    return location.hash.replace(/^#/, "") === "how";
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function setVariant(next) {
    const url = new URL(location.href);
    url.searchParams.set("variant", next);
    history.replaceState(null, "", url);
    render();
  }

  function cycle(delta) {
    const keys = VARIANTS.map((v) => v.key);
    const i = keys.indexOf(variantKey());
    setVariant(keys[(i + delta + keys.length) % keys.length]);
  }

  function goHow() {
    const url = new URL(location.href);
    url.hash = "how";
    history.pushState(null, "", url);
    render();
  }

  function goTree() {
    const url = new URL(location.href);
    url.hash = "";
    history.pushState(null, "", url);
    render();
  }

  function bindEntry(form, input) {
    input.value = state.word;
    input.addEventListener("input", () => {
      state.word = input.value;
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const trimmed = state.word.trim();
      state.wouldBuild = trimmed;
      render();
    });
  }

  function makeEntry() {
    const form = el("form", "entry");
    const input = document.createElement("input");
    input.className = "entry-input";
    input.type = "text";
    input.placeholder = PLACEHOLDER;
    input.setAttribute("autocomplete", "off");
    input.setAttribute("aria-label", ARIA_WORD);
    const button = el("button", "entry-button", "Build");
    button.type = "submit";
    form.append(input, button);
    bindEntry(form, input);
    return form;
  }

  function ghostTree() {
    const wrap = el("div", "ghost-tree");
    wrap.setAttribute("aria-hidden", "true");
    wrap.append(
      el("div", "ghost-crown"),
      el("div", "ghost-trunk"),
      el("div", "ghost-hang")
    );
    wrap.lastChild.append(el("div", "ghost-card"), el("div", "ghost-card"));
    wrap.append(el("p", "ghost-label", "Empty Tree"));
    return wrap;
  }

  function wouldNote() {
    if (!state.wouldBuild) return null;
    return el(
      "p",
      "would-build",
      'Prototype: would build a Tree for "' + state.wouldBuild + '".'
    );
  }

  function howLink() {
    const btn = el(
      "button",
      "how-link",
      onHowPage() ? "Back to the Tree" : "How it works"
    );
    btn.type = "button";
    if (onHowPage()) btn.setAttribute("aria-current", "page");
    btn.addEventListener("click", () => {
      if (onHowPage()) goTree();
      else goHow();
    });
    return btn;
  }

  function header(opts) {
    const bar = el("header", "header");
    const logo = el("div", "logo-row");
    logo.append(el("span", "orb logo-dot"), el("span", "wordmark", "first-principled"));
    bar.append(logo);
    if (opts.entryInHeader) bar.append(makeEntry());
    bar.append(howLink());
    return bar;
  }

  function howPage() {
    const article = el("article", "how-page");
    article.append(el("h1", "", "How it works"));
    for (const para of HOW_PARAS) article.append(el("p", "", para));
    const back = el("div", "back-row");
    const btn = el("button", "back-link", "Back to the Tree");
    btn.type = "button";
    btn.addEventListener("click", goTree);
    back.append(btn);
    article.append(back);
    return article;
  }

  function treeCanvas(key) {
    const canvas = el("div", "canvas");
    const line = el("p", "empty-line", EMPTY_LINE);
    if (key === "A") {
      canvas.append(ghostTree(), line);
    } else if (key === "B") {
      canvas.append(line, makeEntry());
    } else {
      canvas.append(line, ghostTree());
    }
    const note = wouldNote();
    if (note) canvas.append(note);
    return canvas;
  }

  function renderVariant(key) {
    const page = el("div", "page variant-" + key.toLowerCase());
    if (key === "A") {
      page.append(header({ entryInHeader: true }));
      page.append(onHowPage() ? howPage() : treeCanvas(key));
    } else if (key === "B") {
      page.append(header({ entryInHeader: false }));
      page.append(onHowPage() ? howPage() : treeCanvas(key));
    } else {
      page.append(header({ entryInHeader: false }));
      page.append(onHowPage() ? howPage() : treeCanvas(key));
      const dock = el("div", "dock");
      dock.append(makeEntry());
      const note = wouldNote();
      if (note && onHowPage()) dock.append(note);
      page.append(dock);
    }
    return page;
  }

  function switcher() {
    const current = VARIANTS.find((v) => v.key === variantKey());
    const bar = el("div", "switcher");
    bar.setAttribute("role", "navigation");
    bar.setAttribute("aria-label", "Prototype variants");
    const prev = el("button", "", "\u2190");
    prev.type = "button";
    prev.setAttribute("aria-label", "Previous variant");
    prev.addEventListener("click", () => cycle(-1));
    const next = el("button", "", "\u2192");
    next.type = "button";
    next.setAttribute("aria-label", "Next variant");
    next.addEventListener("click", () => cycle(1));
    const label = el("span", "switcher-label", current.key + " - " + current.name);
    bar.append(prev, label, next);
    return bar;
  }

  function render() {
    const root = document.getElementById("root");
    root.replaceChildren();
    const flag = el("div", "proto-flag", "Prototype - not the live app");
    root.append(flag, renderVariant(variantKey()), switcher());
  }

  window.addEventListener("keydown", (event) => {
    const tag = (event.target && event.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || event.target.isContentEditable) {
      return;
    }
    if (event.key === "ArrowLeft") cycle(-1);
    if (event.key === "ArrowRight") cycle(1);
  });

  window.addEventListener("popstate", render);
  window.addEventListener("hashchange", render);
  render();
})();
