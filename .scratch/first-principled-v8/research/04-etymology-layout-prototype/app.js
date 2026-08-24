/**
 * Three variants of the etymology-style Dependence layout.
 * Throwaway. ?variant=A|B|C  ?map=gold|live
 *
 * live = Nemotron arrange slice from v7 diagnostics (gate-failed, but a
 * real extra-parent merge). Not a live LLM call.
 */

const VARIANTS = [
  { key: "A", name: "Etymonline" },
  { key: "B", name: "Chapel" },
  { key: "C", name: "Spine" },
];

const MAPS = [
  { key: "gold", name: "Gold battery" },
  { key: "live", name: "Nemotron slice" },
];

const GOLD = {
  key: "gold",
  concept: "battery",
  caption: "Dependence: what the thing rests on. Not the etymology of the English word.",
  nodes: {
    ions: {
      title: "ions",
      tag: "chemistry",
      gloss: "Charged particles whose movement carries electrical energy inside a chemical cell.",
    },
    electrodes: {
      title: "electrodes",
      tag: "chemistry",
      gloss: "The two terminals where chemical reactions release or accept electrons.",
    },
    electrolyte: {
      title: "electrolyte",
      tag: "the cell",
      gloss: "The medium between the electrodes that lets ions flow while forcing electrons through the outer circuit.",
    },
    battery: {
      title: "battery",
      tag: "the product",
      gloss: "One or more cells that convert stored chemical energy into a steady electrical flow at the terminals.",
    },
  },
  fanIn: ["ions", "electrodes"],
  spine: ["electrolyte", "battery"],
  skip: [{ from: "ions", into: "battery" }],
  trunk: "electrodes -> electrolyte -> battery",
};

/** Slice of v7 battery Arrange (Nemotron). Separator merges two parents. */
const LIVE = {
  key: "live",
  concept: "battery",
  caption: "Same chrome, messier graph: a Nemotron Arrange slice. Separator rests on pile and paste.",
  nodes: {
    pile: {
      title: "voltaic pile",
      tag: "epiphany",
      gloss: "Stacked dissimilar metals in electrolyte that add voltage cell by cell.",
    },
    paste: {
      title: "paste electrodes",
      tag: "epiphany",
      gloss: "A packed active mass that holds shape so a cell can leave the lab dish.",
    },
    separator: {
      title: "separator",
      tag: "epiphany",
      gloss: "A membrane that blocks electronic shorts while ions still cross.",
    },
    sealed: {
      title: "sealed cell",
      tag: "the product",
      gloss: "A closed container that keeps the chemistry inside without an open bath.",
    },
  },
  fanIn: ["pile", "paste"],
  spine: ["separator", "sealed"],
  skip: [{ from: "paste", into: "sealed" }],
  trunk: "voltaic pile -> separator -> sealed cell",
};

function param(name, fallback, allowed) {
  const raw = (new URL(location.href).searchParams.get(name) || fallback).toLowerCase();
  const hit = allowed.find((item) => item.key.toLowerCase() === raw);
  return hit ? hit.key : fallback;
}

function currentVariant() {
  const raw = (new URL(location.href).searchParams.get("variant") || "A").toUpperCase();
  return VARIANTS.some((item) => item.key === raw) ? raw : "A";
}

function currentMap() {
  return param("map", "gold", MAPS) === "live" ? LIVE : GOLD;
}

function setParams(patch) {
  const url = new URL(location.href);
  Object.entries(patch).forEach(([key, value]) => url.searchParams.set(key, value));
  history.replaceState({}, "", url);
  render();
}

function cycleVariant(delta) {
  const i = VARIANTS.findIndex((item) => item.key === currentVariant());
  const next = VARIANTS[(i + delta + VARIANTS.length) % VARIANTS.length];
  setParams({ variant: next.key });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function card(map, id, className, crown) {
  const data = map.nodes[id];
  const wrap = el("article", className + (crown ? " is-crown" : ""));
  wrap.dataset.id = id;
  wrap.append(el("h2", "", data.title), el("span", "tag", data.tag));
  if (!crown || className.startsWith("b-") || className.startsWith("c-")) {
    wrap.append(el("p", "", data.gloss));
  }
  return wrap;
}

function arrowHead(x, y) {
  return `<polygon points="${x - 5.5},${y - 9} ${x + 5.5},${y - 9} ${x},${y}" />`;
}

function mergeSvg(width, fanCount) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "flow-svg");
  svg.setAttribute("viewBox", `0 0 ${width} 56`);
  svg.setAttribute("preserveAspectRatio", "none");
  const mid = width / 2;
  if (fanCount < 2) {
    svg.innerHTML = `<line x1="${mid}" y1="0" x2="${mid}" y2="44" />${arrowHead(mid, 54)}`;
    return svg;
  }
  const left = width * 0.25;
  const right = width * 0.75;
  svg.innerHTML = `
    <path d="M${left} 8 V22 H${right} V8" />
    <line x1="${mid}" y1="22" x2="${mid}" y2="44" />
    ${arrowHead(mid, 54)}
  `;
  return svg;
}

function downSvg(width) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "flow-svg");
  svg.setAttribute("viewBox", `0 0 ${width} 48`);
  svg.setAttribute("preserveAspectRatio", "none");
  const mid = width / 2;
  svg.innerHTML = `<line x1="${mid}" y1="0" x2="${mid}" y2="36" />${arrowHead(mid, 46)}`;
  return svg;
}

function statePanel(map, variantName) {
  const details = el("details", "state");
  details.append(el("summary", "", "Layout locks"));
  const pre = el("pre", "");
  pre.textContent = JSON.stringify(
    {
      variant: variantName,
      map: map.key,
      concept: map.concept,
      orientation: "crown at bottom, supports above",
      arrow: "A down to B means B depends on A",
      fanIn: map.fanIn,
      spine: map.spine,
      trunk: map.trunk,
      skip: map.skip,
      not: ["etymology of the English word", "Chronology / date order"],
    },
    null,
    2
  );
  details.append(pre);
  return details;
}

function flowchart(map, kind) {
  const flow = el("div", "flow flow-" + kind);
  const fan = el("div", "fan");
  map.fanIn.forEach((id) => fan.append(card(map, id, kind + "-card")));
  flow.append(fan);
  flow.append(mergeSvg(560, map.fanIn.length));
  map.spine.forEach((id, index) => {
    if (index > 0) flow.append(downSvg(560));
    const crown = index === map.spine.length - 1;
    const slot = el("div", "spine-slot");
    slot.append(card(map, id, kind + "-card", crown));
    flow.append(slot);
  });
  if (map.skip.length) {
    flow.append(el("p", "skip-note", skipCopy(map)));
  }
  return flow;
}

function skipCopy(map) {
  return map.skip
    .map((edge) => {
      const from = map.nodes[edge.from].title;
      const into = map.nodes[edge.into].title;
      return `${from} also rests under ${into} (extra parent, not a second column)`;
    })
    .join(". ");
}

function variantA(map) {
  const page = el("div", "a-page");
  page.append(el("p", "a-kicker", "Dependence, not etymology"));
  page.append(el("h1", "a-title", map.concept));
  page.append(el("p", "caption", map.caption));
  page.append(flowchart(map, "a"));
  page.append(el("p", "a-foot", "first-principled / word / " + map.concept));
  page.append(statePanel(map, "A Etymonline"));
  return page;
}

function variantB(map) {
  const page = el("div", "b-page");
  const header = el("header", "b-header");
  const logo = el("div", "logo-row");
  logo.append(el("span", "logo-dot"), el("span", "wordmark", "first-principled"));
  const form = el("form", "b-entry");
  const input = document.createElement("input");
  input.value = map.concept;
  input.setAttribute("aria-label", "A thing in reality, from its foundations");
  const build = el("button", "b-build", "Build");
  build.type = "button";
  form.append(input, build);
  const how = el("button", "b-how", "How it works");
  how.type = "button";
  header.append(logo, form, how);
  page.append(header);
  page.append(el("p", "caption", map.caption));
  page.append(flowchart(map, "b"));
  page.append(statePanel(map, "B Chapel"));
  return page;
}

function variantC(map) {
  const page = el("div", "c-page");
  const wrap = el("div", "c-wrap");
  wrap.append(el("p", "c-kicker", "Dependence trunk"));
  wrap.append(el("h1", "c-title", map.concept));
  wrap.append(el("p", "c-lede", map.caption));

  function rail() {
    const node = el("div", "c-rail");
    node.append(el("span", "tick"));
    return node;
  }

  const grid = el("div", "c-grid");
  const top = el("div", "c-row");
  if (map.fanIn[1]) top.append(card(map, map.fanIn[1], "c-side"));
  else top.append(el("div", "c-empty"));
  top.append(rail());
  top.append(card(map, map.fanIn[0], "c-main"));
  grid.append(top);

  map.spine.forEach((id, index) => {
    const row = el("div", "c-row");
    row.append(el("div", "c-empty"));
    row.append(rail());
    const crown = index === map.spine.length - 1;
    const main = card(map, id, "c-main", crown);
    if (crown) main.append(el("p", "c-skip", skipCopy(map)));
    row.append(main);
    grid.append(row);
  });

  wrap.append(grid);
  wrap.append(statePanel(map, "C Spine"));
  page.append(wrap);
  return page;
}

function chromeBar() {
  const bar = el("div", "switcher");
  const prev = el("button", "", "←");
  const next = el("button", "", "→");
  const label = el("span", "label");
  const variant = VARIANTS.find((item) => item.key === currentVariant());
  label.textContent = `${variant.key}  ${variant.name}`;
  prev.type = "button";
  next.type = "button";
  prev.addEventListener("click", () => cycleVariant(-1));
  next.addEventListener("click", () => cycleVariant(1));

  const mapBtn = el("button", "map-toggle", currentMap().key === "live" ? "Nemotron slice" : "Gold battery");
  mapBtn.type = "button";
  mapBtn.addEventListener("click", () => {
    setParams({ map: currentMap().key === "live" ? "gold" : "live" });
  });

  bar.append(prev, label, next, mapBtn);
  return bar;
}

function render() {
  const root = document.getElementById("root");
  const map = currentMap();
  const key = currentVariant();
  root.replaceChildren();
  if (key === "B") root.append(variantB(map));
  else if (key === "C") root.append(variantC(map));
  else root.append(variantA(map));
  root.append(chromeBar());
}

document.addEventListener("keydown", (event) => {
  const tag = event.target && event.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || event.target.isContentEditable) return;
  if (event.key === "ArrowLeft") cycleVariant(-1);
  if (event.key === "ArrowRight") cycleVariant(1);
  if (event.key === "g" || event.key === "G") setParams({ map: "gold" });
  if (event.key === "l" || event.key === "L") setParams({ map: "live" });
});

render();
