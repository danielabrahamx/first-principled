/**
 * How it works chrome (ticket 05): locked grilling copy from the accepted
 * variant A prototype. Header control + short page; the empty-Tree sentence
 * and foundations word box live in map.js and import these strings.
 *
 * Do not rewrite this copy. Ticket 03 accepted it as-is.
 */

export const WORD_PLACEHOLDER = "A thing in reality (laptop, photosynthesis)";

export const EMPTY_LINE =
  "Type the thing you want to understand from its foundations.";

export const WORD_ARIA =
  "A thing in reality to understand from its foundations";

export const HOW_TITLE = "How it works";

export const HOW_BACK = "Back to the Tree";

export const HOW_PARAS = Object.freeze([
  "This is not designed to replace reading.",
  "It is for gaining understanding of relationships between layers.",
  "It is meant to help you open your own rabbit holes. Each node is a rabbit hole for the thing you wanted to learn.",
  "Type a thing in reality and understand it from its foundations.",
]);

/**
 * @param {string} [hash]
 * @returns {boolean}
 */
export function isHowRoute(hash) {
  return String(hash ?? "").replace(/^#/, "") === "how";
}

/**
 * Short How it works page. Back to the Tree keeps the header word box.
 *
 * @param {() => void} onBack
 * @returns {HTMLElement}
 */
export function renderHowPage(onBack) {
  const article = document.createElement("article");
  article.className = "how-page";
  article.hidden = true;
  const heading = document.createElement("h1");
  heading.textContent = HOW_TITLE;
  article.appendChild(heading);
  for (const para of HOW_PARAS) {
    const p = document.createElement("p");
    p.textContent = para;
    article.appendChild(p);
  }
  const back = document.createElement("div");
  back.className = "how-back-row";
  const btn = document.createElement("button");
  btn.className = "how-back-link";
  btn.type = "button";
  btn.textContent = HOW_BACK;
  btn.addEventListener("click", onBack);
  back.appendChild(btn);
  article.appendChild(back);
  return article;
}
