/* global pdfjsLib */

const $ = (sel) => document.querySelector(sel);

const tabText = $("#tab-text");
const tabPdf  = $("#tab-pdf");
const paneText = $("#pane-text");
const panePdf  = $("#pane-pdf");

const inputText = $("#inputText");
const output = $("#output");
const stats = $("#stats");
const statusEl = $("#status");

const intensity = $("#intensity");
const intensityVal = $("#intensityVal");
const mode = $("#mode");
const fontSize = $("#fontSize");

const pdfFile = $("#pdfFile");
const pdfProgress = $("#pdfProgress");
const pdfBar = $("#pdfBar");
const pdfStatus = $("#pdfStatus");

$("#year").textContent = new Date().getFullYear();

// ---------- Tabs ----------
function setTab(which){
  const isText = which === "text";
  tabText.classList.toggle("active", isText);
  tabPdf.classList.toggle("active", !isText);
  tabText.setAttribute("aria-selected", String(isText));
  tabPdf.setAttribute("aria-selected", String(!isText));
  paneText.classList.toggle("hidden", !isText);
  panePdf.classList.toggle("hidden", isText);
}
tabText.addEventListener("click", () => setTab("text"));
tabPdf.addEventListener("click", () => setTab("pdf"));

// ---------- Controls ----------
intensity.addEventListener("input", () => {
  intensityVal.textContent = `${intensity.value}%`;
});

fontSize.addEventListener("change", () => {
  output.style.fontSize = `${fontSize.value}px`;
});

// ---------- Bionic conversion ----------
function wordToBionicHTML(word, ratio, styleClass){
  // Keep punctuation around words (simple heuristic)
  const m = word.match(/^(\W*)([\p{L}\p{N}]+)(\W*)$/u);
  if(!m) return escapeHTML(word);

  const lead = m[1] || "";
  const core = m[2] || "";
  const tail = m[3] || "";

  if(core.length <= 1) return `${escapeHTML(lead)}${escapeHTML(core)}${escapeHTML(tail)}`;

  const cut = Math.max(1, Math.min(core.length - 1, Math.round(core.length * ratio)));
  const a = core.slice(0, cut);
  const b = core.slice(cut);

  return `${escapeHTML(lead)}<span class="${styleClass}">${escapeHTML(a)}</span>${escapeHTML(b)}${escapeHTML(tail)}`;
}

function paragraphToBionicHTML(text, ratio, styleClass){
  // Convert word by word while keeping whitespace
  const tokens = text.split(/(\s+)/);
  return tokens.map(t => {
    if(/\s+/.test(t)) return t;
    return wordToBionicHTML(t, ratio, styleClass);
  }).join("");
}

function convertText(raw){
  const ratio = Number(intensity.value) / 100;
  const styleClass =
    mode.value === "red" ? "br-red" :
    mode.value === "bold" ? "br-bold" :
    "br-underline";

  // Split into paragraphs
  const paras = raw
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);

  const html = paras.map(p => `<p>${paragraphToBionicHTML(p, ratio, styleClass)}</p>`).join("");
  output.innerHTML = html || `<p class="muted">Kein Text gefunden.</p>`;

  const wc = countWords(raw);
  stats.textContent = `${wc} Wörter`;
  statusEl.textContent = "Fertig.";
}

function countWords(s){
  const m = s.match(/[\p{L}\p{N}]+/gu);
  return m ? m.length : 0;
}

function escapeHTML(str){
  return str
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

// ---------- Buttons ----------
$("#btn-convert-text").addEventListener("click", () => {
  statusEl.textContent = "Konvertiere…";
  convertText(inputText.value || "");
});

$("#btn-clear").addEventListener("click", () => {
  inputText.value = "";
  output.innerHTML = `<p class="muted">Bereit.</p>`;
  stats.textContent = `0 Wörter`;
  statusEl.textContent = "Bereit.";
});

$("#btn-demo").addEventListener("click", () => {
  setTab("text");
  inputText.value =
`Bionic Reading kann dir helfen, schneller und fokussierter zu lesen.

Es markiert einen Teil jedes Wortes, damit dein Gehirn schneller „einrastet“.
Teste die Intensität und finde heraus, was sich für dich am besten anfühlt.`;
  convertText(inputText.value);
});

// Copy plain text (no markup)
$("#btn-copy").addEventListener("click", async () => {
  try{
    const txt = output.innerText || "";
    await navigator.clipboard.writeText(txt);
    statusEl.textContent = "Text kopiert.";
  }catch(e){
    statusEl.textContent = "Kopieren nicht erlaubt (Browser).";
  }
});

// Export HTML (keeps markup)
$("#btn-export").addEventListener("click", () => {
  const htmlDoc =
`<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Bionic Reading Export</title>
<style>
  body{font-family:system-ui,Segoe UI,Roboto,Arial;margin:24px;line-height:1.8}
  .br-red{color:#ff3b5c;font-weight:800}
  .br-bold{font-weight:800}
  .br-underline{text-decoration:underline;text-decoration-thickness:2px}
</style>
</head>
<body>
${output.innerHTML}
</body>
</html>`;

  const blob = new Blob([htmlDoc], {type:"text/html;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "bionic-reading-export.html";
  a.click();
  URL.revokeObjectURL(a.href);
  statusEl.textContent = "HTML gespeichert.";
});

// ---------- PDF Handling ----------
function setPdfProgress(visible, pct = 0, msg = ""){
  pdfProgress.classList.toggle("hidden", !visible);
  pdfBar.style.width = `${pct}%`;
  pdfStatus.textContent = msg || (visible ? "Lade…" : "Bereit.");
}

$("#btn-pdf-reset").addEventListener("click", () => {
  pdfFile.value = "";
  setPdfProgress(false, 0, "Bereit.");
  statusEl.textContent = "Bereit.";
});

$("#btn-convert-pdf").addEventListener("click", async () => {
  const file = pdfFile.files?.[0];
  if(!file){
    statusEl.textContent = "Bitte PDF auswählen.";
    return;
  }

  try{
    statusEl.textContent = "PDF wird gelesen…";
    setPdfProgress(true, 5, "PDF wird geladen…");

    // PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.worker.min.js";

    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;

    const pages = pdf.numPages;
    let allText = "";

    for(let p = 1; p <= pages; p++){
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const strings = content.items.map(it => it.str);
      // Join with spaces; keep page separation as paragraphs
      allText += strings.join(" ") + "\n\n";

      const pct = Math.round((p / pages) * 100);
      setPdfProgress(true, pct, `Seite ${p}/${pages} extrahiert…`);
    }

    setPdfProgress(true, 100, "Fertig. Konvertiere…");
    convertText(allText);
    statusEl.textContent = "PDF konvertiert.";
    setTab("text"); // show output + keep UI consistent

  }catch(err){
    console.error(err);
    statusEl.textContent = "PDF konnte nicht verarbeitet werden.";
    setPdfProgress(true, 0, "Fehler beim Lesen der PDF.");
  }
});

// Default font size
output.style.fontSize = `${fontSize.value}px`;
