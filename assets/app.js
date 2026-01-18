/* global pdfjsLib */

const $ = (sel) => document.querySelector(sel);

// UI
const tabText = $("#tab-text");
const tabPdf  = $("#tab-pdf");
const paneText = $("#pane-text");
const panePdf  = $("#pane-pdf");

const inputText = $("#inputText");
const bionicOut = $("#bionicOut");
const stats = $("#stats");
const statusEl = $("#status");

const intensity = $("#intensity");
const intensityVal = $("#intensityVal");
const markStyle = $("#markStyle");

const wpm = $("#wpm");
const wpmVal = $("#wpmVal");
const orpMode = $("#orpMode");

const pdfFile = $("#pdfFile");
const pdfProgress = $("#pdfProgress");
const pdfBar = $("#pdfBar");
const pdfStatus = $("#pdfStatus");

// Speedreader display
const spritzLeft = $("#spritzLeft");
const spritzPivot = $("#spritzPivot");
const spritzRight = $("#spritzRight");
const spritzPos = $("#spritzPos");
const spritzInfo = $("#spritzInfo");
const spritzSub = $("#spritzSub");

// Buttons
const btnLoadText = $("#btn-load-text");
const btnClear = $("#btn-clear");
const btnDemo = $("#btn-demo");

const btnLoadPdf = $("#btn-load-pdf");
const btnPdfReset = $("#btn-pdf-reset");

const btnBionic = $("#btn-bionic");
const btnExport = $("#btn-export");

const btnPlay = $("#btn-play");
const btnPause = $("#btn-pause");
const btnStop = $("#btn-stop");
const btnBack = $("#btn-back");
const btnForward = $("#btn-forward");

$("#year").textContent = new Date().getFullYear();

// State
let loadedText = "";            // the text currently loaded from text area or PDF
let tokens = [];                 // speedreader tokens
let idx = 0;                     // current token index
let timer = null;                // setTimeout handle
let isPlaying = false;

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

wpm.addEventListener("input", () => {
  wpmVal.textContent = String(wpm.value);
  spritzInfo.textContent = `${wpm.value} wpm`;
});

function setPdfProgress(visible, pct = 0, msg = ""){
  pdfProgress.classList.toggle("hidden", !visible);
  pdfBar.style.width = `${pct}%`;
  pdfStatus.textContent = msg || (visible ? "Lade…" : "Bereit.");
}

// ---------- Text loading ----------
function setLoadedText(text, sourceLabel){
  loadedText = (text || "").trim();
  const wc = countWords(loadedText);
  stats.textContent = `${wc} Wörter`;
  statusEl.textContent = wc ? `Geladen (${sourceLabel}).` : "Kein Text.";

  // Prepare speedreader tokens
  tokens = tokenizeForSpeedreader(loadedText);
  idx = 0;
  updateSpritzUIIdle();
  updateSpeedButtons();
}

btnLoadText.addEventListener("click", () => {
  setLoadedText(inputText.value, "Text");
});

btnClear.addEventListener("click", () => {
  inputText.value = "";
  stopSpeedreader(true);
  loadedText = "";
  tokens = [];
  idx = 0;
  stats.textContent = "0 Wörter";
  statusEl.textContent = "Bereit.";
  bionicOut.innerHTML = `<p class="muted">Text laden → „Bionic anzeigen“.</p>`;
  updateSpritzUIIdle();
  updateSpeedButtons();
});

btnDemo.addEventListener("click", () => {
  setTab("text");
  inputText.value = `300 wpm wie im Video – mit ORP (Optimal Recognition Point).\n\nDieser Speedreader zeigt Wörter nacheinander und markiert den Fixierpunkt in der Wortmitte.\nDu kannst WPM ändern, pausieren und springen.`;
  setLoadedText(inputText.value, "Demo");
  renderBionic();
});

// ---------- PDF loading ----------
btnPdfReset.addEventListener("click", () => {
  pdfFile.value = "";
  setPdfProgress(false, 0, "Bereit.");
  statusEl.textContent = "Bereit.";
});

btnLoadPdf.addEventListener("click", async () => {
  const file = pdfFile.files?.[0];
  if(!file){
    statusEl.textContent = "Bitte PDF auswählen.";
    return;
  }

  try{
    statusEl.textContent = "PDF wird gelesen…";
    setPdfProgress(true, 5, "PDF wird geladen…");

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
      allText += strings.join(" ") + "\n\n";

      const pct = Math.round((p / pages) * 100);
      setPdfProgress(true, pct, `Seite ${p}/${pages} extrahiert…`);
    }

    setPdfProgress(true, 100, "Fertig.");
    setLoadedText(allText, "PDF");

  }catch(err){
    console.error(err);
    statusEl.textContent = "PDF konnte nicht verarbeitet werden.";
    setPdfProgress(true, 0, "Fehler beim Lesen der PDF.");
  }
});

// ---------- Bionic Reading rendering ----------
function styleClass(){
  return markStyle.value === "red" ? "br-red" :
         markStyle.value === "bold" ? "br-bold" :
         "br-underline";
}

function renderBionic(){
  if(!loadedText){
    bionicOut.innerHTML = `<p class="muted">Bitte zuerst Text laden.</p>`;
    return;
  }
  statusEl.textContent = "Konvertiere…";

  const ratio = Number(intensity.value) / 100;
  const cls = styleClass();

  const paras = loadedText
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);

  const html = paras.map(p => `<p>${paragraphToBionicHTML(p, ratio, cls)}</p>`).join("");
  bionicOut.innerHTML = html || `<p class="muted">Kein Text gefunden.</p>`;
  statusEl.textContent = "Fertig.";
}

btnBionic.addEventListener("click", renderBionic);

btnExport.addEventListener("click", () => {
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
${bionicOut.innerHTML}
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

function paragraphToBionicHTML(text, ratio, cls){
  const tokens = text.split(/(\s+)/);
  return tokens.map(t => {
    if(/\s+/.test(t)) return t;
    return wordToBionicHTML(t, ratio, cls);
  }).join("");
}

function wordToBionicHTML(word, ratio, cls){
  const m = word.match(/^(\W*)([\p{L}\p{N}]+)(\W*)$/u);
  if(!m) return escapeHTML(word);

  const lead = m[1] || "";
  const core = m[2] || "";
  const tail = m[3] || "";

  if(core.length <= 1) return `${escapeHTML(lead)}${escapeHTML(core)}${escapeHTML(tail)}`;

  const cut = Math.max(1, Math.min(core.length - 1, Math.round(core.length * ratio)));
  const a = core.slice(0, cut);
  const b = core.slice(cut);

  return `${escapeHTML(lead)}<span class="${cls}">${escapeHTML(a)}</span>${escapeHTML(b)}${escapeHTML(tail)}`;
}

function escapeHTML(str){
  return str
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/\"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function countWords(s){
  const m = s.match(/[\p{L}\p{N}]+/gu);
  return m ? m.length : 0;
}

// ---------- Speedreader (RSVP / ORP) ----------
function tokenizeForSpeedreader(text){
  if(!text) return [];
  // Split into tokens: words + punctuation as separate tokens, keep \n as break
  // We keep words and punctuation so we can add pauses.
  const out = [];
  const re = /\n+|[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*|[.,!?;:()\[\]{}"“”„…]+|\S/gu;
  let m;
  while((m = re.exec(text)) !== null){
    out.push(m[0]);
  }
  // Merge consecutive newlines into a single break token
  const merged = [];
  for(const t of out){
    if(/^\n+$/.test(t)){
      if(merged.length === 0 || merged[merged.length-1] !== "\n") merged.push("\n");
    } else {
      merged.push(t);
    }
  }
  // Remove leading breaks
  while(merged[0] === "\n") merged.shift();
  return merged;
}

function orpIndexSpritz(len){
  // Common Spritz-like heuristic
  if(len <= 1) return 0;
  if(len <= 5) return 1;
  if(len <= 9) return 2;
  if(len <= 13) return 3;
  return 4;
}

function orpIndexMiddle(len){
  if(len <= 1) return 0;
  return Math.floor((len - 1) / 2);
}

function splitForOrp(token){
  // token may include punctuation; try to focus on alnum core
  const m = token.match(/^(\W*)([\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*)(\W*)$/u);
  if(!m){
    return { left: token, pivot: "", right: "", isWord: false };
  }
  const lead = m[1] || "";
  const core = m[2] || "";
  const tail = m[3] || "";

  const idxFn = (orpMode.value === "middle") ? orpIndexMiddle : orpIndexSpritz;
  const i = Math.min(core.length - 1, Math.max(0, idxFn(core.length)));

  const left = lead + core.slice(0, i);
  const pivot = core.slice(i, i+1);
  const right = core.slice(i+1) + tail;

  return { left, pivot, right, isWord: true };
}

function isHardBreak(token){
  return token === "\n";
}

function isPunct(token){
  return /^[.,!?;:…]+$/.test(token);
}

function isLongPunct(token){
  return /^[.!?…]+$/.test(token);
}

function baseDelayMs(){
  const w = Number(wpm.value) || 300;
  return Math.round(60000 / w);
}

function extraPauseFor(token){
  // Add extra time for punctuation / line breaks
  if(isHardBreak(token)) return 260;
  if(isLongPunct(token)) return 220;
  if(isPunct(token)) return 120;
  return 0;
}

function showToken(token){
  if(isHardBreak(token)){
    spritzLeft.textContent = "";
    spritzPivot.textContent = "";
    spritzRight.textContent = "";
    spritzSub.textContent = "Absatz";
    return;
  }

  const parts = splitForOrp(token);
  if(!parts.isWord){
    // If it's pure punctuation etc., show centered lightly
    spritzLeft.textContent = "";
    spritzPivot.textContent = token;
    spritzRight.textContent = "";
    spritzSub.textContent = "";
    return;
  }

  spritzLeft.textContent = parts.left;
  spritzPivot.textContent = parts.pivot;
  spritzRight.textContent = parts.right;
  spritzSub.textContent = "";
}

function updateSpritzUIIdle(){
  spritzLeft.textContent = "";
  spritzPivot.textContent = "";
  spritzRight.textContent = "";
  spritzPos.textContent = `${tokens.length ? (idx+1) : 0}/${tokens.length}`;
  spritzInfo.textContent = `${wpm.value} wpm`;
  spritzSub.textContent = tokens.length ? "Bereit. Drücke Start." : "Kein Text geladen.";
}

function updateSpeedButtons(){
  const has = tokens.length > 0;
  btnPlay.disabled = !has || isPlaying;
  btnPause.disabled = !has || !isPlaying;
  btnStop.disabled = !has || (!isPlaying && idx === 0);
  btnBack.disabled = !has;
  btnForward.disabled = !has;
}

function scheduleNext(){
  if(!isPlaying) return;

  if(idx >= tokens.length){
    stopSpeedreader(false);
    spritzSub.textContent = "Fertig.";
    return;
  }

  const token = tokens[idx];
  showToken(token);
  spritzPos.textContent = `${idx+1}/${tokens.length}`;
  spritzInfo.textContent = `${wpm.value} wpm`;

  const delay = baseDelayMs() + extraPauseFor(token);
  idx += 1;

  timer = setTimeout(scheduleNext, delay);
}

function playSpeedreader(){
  if(!tokens.length){
    spritzSub.textContent = "Bitte zuerst Text laden.";
    return;
  }
  if(isPlaying) return;

  isPlaying = true;
  spritzSub.textContent = "Läuft…";
  statusEl.textContent = "Speedreader läuft…";
  updateSpeedButtons();
  scheduleNext();
}

function pauseSpeedreader(){
  if(!isPlaying) return;
  isPlaying = false;
  if(timer) clearTimeout(timer);
  timer = null;
  spritzSub.textContent = "Pausiert.";
  statusEl.textContent = "Pausiert.";
  updateSpeedButtons();
}

function stopSpeedreader(resetToStart){
  if(timer) clearTimeout(timer);
  timer = null;
  isPlaying = false;
  if(resetToStart) idx = 0;
  statusEl.textContent = "Bereit.";
  updateSpritzUIIdle();
  updateSpeedButtons();
}

function jump(delta){
  if(!tokens.length) return;
  idx = Math.max(0, Math.min(tokens.length - 1, idx + delta));
  showToken(tokens[idx]);
  spritzPos.textContent = `${idx+1}/${tokens.length}`;
  spritzSub.textContent = isPlaying ? "Läuft…" : "Bereit.";
}

btnPlay.addEventListener("click", playSpeedreader);
btnPause.addEventListener("click", pauseSpeedreader);
btnStop.addEventListener("click", () => stopSpeedreader(true));
btnBack.addEventListener("click", () => jump(-10));
btnForward.addEventListener("click", () => jump(10));

// Space toggles play/pause
document.addEventListener("keydown", (e) => {
  if(e.code === "Space"){
    // avoid scrolling when focused not in textarea
    if(document.activeElement && document.activeElement.tagName === "TEXTAREA") return;
    e.preventDefault();
    if(isPlaying) pauseSpeedreader();
    else playSpeedreader();
  }
  if(e.code === "ArrowRight"){
    if(document.activeElement && document.activeElement.tagName === "TEXTAREA") return;
    jump(+1);
  }
  if(e.code === "ArrowLeft"){
    if(document.activeElement && document.activeElement.tagName === "TEXTAREA") return;
    jump(-1);
  }
});

// Initial
spritzInfo.textContent = `${wpm.value} wpm`;
updateSpritzUIIdle();
updateSpeedButtons();
