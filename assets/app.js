const $ = (sel) => document.querySelector(sel);

// UI
const inputText = $("#inputText");
const stats = $("#stats");
const statusEl = $("#status");

const wpm = $("#wpm");
const wpmVal = $("#wpmVal");
const orpMode = $("#orpMode");

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

const btnPlay = $("#btn-play");
const btnPause = $("#btn-pause");
const btnStop = $("#btn-stop");
const btnBack = $("#btn-back");
const btnForward = $("#btn-forward");

$("#year").textContent = new Date().getFullYear();

// State
let loadedText = "";
let tokens = [];
let idx = 0;
let timer = null;
let isPlaying = false;

// ---- helpers
function countWords(s){
  const m = s.match(/[\p{L}\p{N}]+/gu);
  return m ? m.length : 0;
}

function tokenizeForSpeedreader(text){
  if(!text) return [];
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
      if(merged.length === 0 || merged[merged.length - 1] !== "\n") merged.push("\n");
    } else {
      merged.push(t);
    }
  }
  while(merged[0] === "\n") merged.shift();
  return merged;
}

function orpIndexSpritz(len){
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
  const m = token.match(/^(\W*)([\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*)(\W*)$/u);
  if(!m){
    return { left: token, pivot: "", right: "", isWord: false };
  }
  const lead = m[1] || "";
  const core = m[2] || "";
  const tail = m[3] || "";

  const idxFn = (orpMode.value === "middle") ? orpIndexMiddle : orpIndexSpritz;
  const i = Math.min(core.length - 1, Math.max(0, idxFn(core.length)));

  return {
    left: lead + core.slice(0, i),
    pivot: core.slice(i, i + 1),
    right: core.slice(i + 1) + tail,
    isWord: true
  };
}

function isHardBreak(token){ return token === "\n"; }
function isPunct(token){ return /^[.,!?;:…]+$/.test(token); }
function isLongPunct(token){ return /^[.!?…]+$/.test(token); }

function baseDelayMs(){
  const v = Number(wpm.value) || 300;
  return Math.round(60000 / v);
}

function extraPauseFor(token){
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
  spritzPos.textContent = `${tokens.length ? (idx + 1) : 0}/${tokens.length}`;
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
  spritzPos.textContent = `${idx + 1}/${tokens.length}`;
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
  spritzPos.textContent = `${idx + 1}/${tokens.length}`;
  spritzSub.textContent = isPlaying ? "Läuft…" : "Bereit.";
}

// ---- events
wpm.addEventListener("input", () => {
  wpmVal.textContent = String(wpm.value);
  spritzInfo.textContent = `${wpm.value} wpm`;
});

btnLoadText.addEventListener("click", () => {
  loadedText = (inputText.value || "").trim();
  tokens = tokenizeForSpeedreader(loadedText);
  idx = 0;

  const wc = countWords(loadedText);
  stats.textContent = `${wc} Wörter`;
  statusEl.textContent = wc ? "Geladen." : "Kein Text.";

  updateSpritzUIIdle();
  updateSpeedButtons();
});

btnClear.addEventListener("click", () => {
  inputText.value = "";
  loadedText = "";
  tokens = [];
  idx = 0;
  stopSpeedreader(true);
  stats.textContent = "0 Wörter";
  statusEl.textContent = "Bereit.";
});

btnDemo.addEventListener("click", () => {
  inputText.value =
`Speedreading mit RSVP: Wörter erscheinen nacheinander.
Der ORP-Buchstabe bleibt an einer stabilen Position.

Stelle WPM ein, drücke Start und teste die Lesegeschwindigkeit.
Nutze Space für Play/Pause.`;
  btnLoadText.click();
});

btnPlay.addEventListener("click", playSpeedreader);
btnPause.addEventListener("click", pauseSpeedreader);
btnStop.addEventListener("click", () => stopSpeedreader(true));
btnBack.addEventListener("click", () => jump(-10));
btnForward.addEventListener("click", () => jump(10));

document.addEventListener("keydown", (e) => {
  if(e.code === "Space"){
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

// init
wpmVal.textContent = String(wpm.value);
spritzInfo.textContent = `${wpm.value} wpm`;
updateSpritzUIIdle();
updateSpeedButtons();