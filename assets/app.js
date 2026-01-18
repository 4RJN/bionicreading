const input = document.getElementById("input");
const wpmSlider = document.getElementById("wpm");
const wpmValue = document.getElementById("wpmValue");

const startBtn = document.getElementById("start");
const pauseBtn = document.getElementById("pause");
const stopBtn = document.getElementById("stop");

const leftSpan = document.querySelector(".left");
const orpSpan = document.querySelector(".orp");
const rightSpan = document.querySelector(".right");

let words = [];
let index = 0;
let timer = null;
let paused = false;

wpmSlider.addEventListener("input", () => {
  wpmValue.textContent = wpmSlider.value;
});

function orpIndex(len) {
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

function showWord(word) {
  const clean = word.replace(/[^\p{L}\p{N}]/gu, "");
  if (!clean) return;

  const i = Math.min(clean.length - 1, orpIndex(clean.length));

  leftSpan.textContent = clean.slice(0, i);
  orpSpan.textContent = clean[i];
  rightSpan.textContent = clean.slice(i + 1);
}

function start() {
  if (!paused) {
    words = input.value.split(/\s+/);
    index = 0;
  }

  paused = false;
  const delay = 60000 / wpmSlider.value;

  timer = setInterval(() => {
    if (index >= words.length) {
      stop();
      return;
    }
    showWord(words[index]);
    index++;
  }, delay);
}

function pause() {
  paused = true;
  clearInterval(timer);
}

function stop() {
  clearInterval(timer);
  paused = false;
  index = 0;
  leftSpan.textContent = "";
  orpSpan.textContent = "";
  rightSpan.textContent = "";
}

startBtn.addEventListener("click", start);
pauseBtn.addEventListener("click", pause);
stopBtn.addEventListener("click", stop);