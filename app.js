"use strict";

const TAU = Math.PI * 2;
const RADIUS_METRES = 0.25;
const MASS_KG = 0.1;
const MOMENT_OF_INERTIA = 0.5 * MASS_KG * RADIUS_METRES ** 2;
const palette = ["#1358c8", "#287bd0", "#18a4a6", "#2d9c6f", "#e29e24", "#e5683f", "#805bc5", "#c34e83", "#0c73ba", "#4f78d1"];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  canvas: $("#wheelCanvas"), wheel: $("#wheelButton"), hub: $("#wheelHub"), spacePrompt: $("#spacePrompt"), wheelNote: $("#wheelNote"),
  studentCount: $("#studentCount"), speed: $("#speedRange"), speedOutput: $("#speedOutput"), duration: $("#durationRange"), durationOutput: $("#durationOutput"), durationDescription: $("#durationDescription"), cooldown: $("#cooldownRounds"),
  boostStudent: $("#boostStudent"), boostMultiplier: $("#boostMultiplier"), fairAlert: $("#fairAlert"), excludedInput: $("#excludedStudent"), excludedList: $("#excludedList"),
  historyList: $("#historyList"), totalRounds: $("#totalRounds"), uniqueStudents: $("#uniqueStudents"), unselectedStudents: $("#unselectedStudents"), fairnessRating: $("#fairnessRating"), eligibleCount: $("#eligibleCount"), undo: $("#undoButton"),
  omega: $("#omega"), velocity: $("#velocity"), rpm: $("#rpm"), acceleration: $("#acceleration"), gravity: $("#gravity"), frequency: $("#frequency"), period: $("#period"), angle: $("#angle"), energy: $("#energy"), relativity: $("#relativity"), developerRow: $("#developerRow"),
  resultModal: $("#resultModal"), selectedNumber: $("#selectedNumber"), resultKicker: $("#resultKicker"), resultMessage: $("#resultMessage"), resultRound: $("#resultRound"),
  statsModal: $("#statsModal"), statsSummary: $("#statsSummary"), distribution: $("#distribution"),
  paymentModal: $("#paymentModal"), paymentFeature: $("#paymentFeature"), paymentPrice: $("#paymentPrice"), paymentFormView: $("#paymentFormView"), paymentProcess: $("#paymentProcess"), paymentError: $("#paymentError"), processSteps: $("#processSteps"), processLog: $("#processLog"),
  toastRegion: $("#toastRegion"), sound: $("#soundToggle")
};

const query = new URLSearchParams(location.search);
const intParam = (key, fallback, min, max) => Math.min(max, Math.max(min, Number.parseInt(query.get(key), 10) || fallback));

const state = {
  studentCount: intParam("students", 40, 2, 100),
  cooldown: intParam("cooldown", 3, 0, 10),
  speed: intParam("speed", 7, 1, 10),
  duration: intParam("duration", 5, 1, 15),
  boostStudent: null,
  boostMultiplier: 1,
  excluded: new Set(),
  order: [],
  history: [],
  rotation: 0,
  totalAngle: 0,
  omega: 0,
  spinning: false,
  infiniteSpin: false,
  infiniteStartedAt: 0,
  animationFrame: 0,
  canvasSize: 0,
  lastFocused: null,
  pendingSelection: null,
  paymentTimer: 0,
  developerMode: false,
  accountClicks: 0,
  accountClickTimer: 0,
  audioContext: null
};

function randomUnit() {
  if (globalThis.crypto?.getRandomValues) {
    const bucket = new Uint32Array(1);
    crypto.getRandomValues(bucket);
    return bucket[0] / 4294967296;
  }
  return Math.random();
}

function shuffle(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomUnit() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clampInput(input, min, max, fallback) {
  const parsed = Number.parseInt(input.value, 10);
  const value = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  input.value = value;
  return value;
}

function padStudent(number) {
  return String(number).padStart(2, "0");
}

function normalized(angle) {
  return ((angle % TAU) + TAU) % TAU;
}

function activeStudents() {
  return state.order.filter((student) => student <= state.studentCount && !state.excluded.has(student));
}

function cooldownRemaining(student) {
  const latest = [...state.history].reverse().find((draw) => draw.student === student);
  if (!latest) return 0;
  return Math.max(0, state.cooldown - (state.history.length - latest.round));
}

function isCooling(student) {
  return cooldownRemaining(student) > 0;
}

function sectors() {
  let students = activeStudents();
  if (state.boostMultiplier === Infinity && students.includes(state.boostStudent)) students = [state.boostStudent];
  if (!students.length) return [];
  const weights = students.map((student) => {
    if (state.boostMultiplier !== Infinity && student === state.boostStudent) return state.boostMultiplier;
    return 1;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let offset = 0;
  return students.map((student, index) => {
    const width = TAU * weights[index] / total;
    const sector = { student, startOffset: offset, endOffset: offset + width, width, cooling: isCooling(student) };
    offset += width;
    return sector;
  });
}

function resizeCanvas() {
  const rect = els.wheel.getBoundingClientRect();
  const size = Math.max(250, Math.round(rect.width));
  const dpr = Math.min(2, devicePixelRatio || 1);
  state.canvasSize = size;
  els.canvas.width = Math.round(size * dpr);
  els.canvas.height = Math.round(size * dpr);
  drawWheel();
}

function drawWheel() {
  const canvas = els.canvas;
  const ctx = canvas.getContext("2d");
  if (!ctx || !state.canvasSize) return;
  const dpr = canvas.width / state.canvasSize;
  const size = state.canvasSize;
  const radius = size / 2;
  const list = sectors();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(radius, radius);
  ctx.rotate(state.rotation);

  if (!list.length) {
    ctx.beginPath(); ctx.arc(0, 0, radius - 2, 0, TAU); ctx.fillStyle = "#e7edf6"; ctx.fill();
  }

  list.forEach((sector, index) => {
    const start = -Math.PI / 2 + sector.startOffset;
    const end = -Math.PI / 2 + sector.endOffset;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, radius - 2, start, end); ctx.closePath();
    ctx.fillStyle = palette[index % palette.length];
    ctx.globalAlpha = sector.cooling && state.boostMultiplier !== Infinity ? 0.28 : 1;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,.82)"; ctx.lineWidth = Math.max(1, size / 520); ctx.stroke();

    const middle = (start + end) / 2;
    const labelRadius = radius * (list.length > 50 ? .82 : .76);
    const fontSize = list.length > 70 ? 7 : list.length > 48 ? 9 : list.length > 30 ? 11 : list.length > 16 ? 13 : 17;
    ctx.save();
    ctx.rotate(middle); ctx.translate(labelRadius, 0); ctx.rotate(Math.PI / 2);
    ctx.fillStyle = sector.cooling && state.boostMultiplier !== Infinity ? "rgba(255,255,255,.7)" : "#fff";
    ctx.font = `800 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(15,23,42,.25)"; ctx.shadowBlur = 2;
    ctx.fillText(padStudent(sector.student), 0, 0);
    ctx.restore();
  });

  ctx.beginPath(); ctx.arc(0, 0, radius - 2, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(15,23,42,.14)"; ctx.stroke();
  ctx.restore();
}

function eligibleStudents() {
  const active = activeStudents();
  if (state.boostMultiplier === Infinity && active.includes(state.boostStudent)) return [state.boostStudent];
  let eligible = active.filter((student) => !isCooling(student));
  if (!eligible.length && active.length) {
    const smallestCooldown = Math.min(...active.map(cooldownRemaining));
    eligible = active.filter((student) => cooldownRemaining(student) === smallestCooldown);
    toast("可抽選人數不足，已提前解除最早一組冷卻保護。");
  }
  return eligible;
}

function weightedChoice(candidates) {
  if (!candidates.length) return null;
  if (state.boostMultiplier === Infinity && candidates.includes(state.boostStudent)) return state.boostStudent;
  const weighted = candidates.map((student) => ({ student, weight: student === state.boostStudent ? state.boostMultiplier : 1 }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = randomUnit() * total;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.student;
  }
  return weighted.at(-1).student;
}

function telemetry() {
  const omega = Math.abs(state.omega);
  const velocity = RADIUS_METRES * omega;
  const acceleration = RADIUS_METRES * omega ** 2;
  els.omega.textContent = omega.toFixed(2);
  els.velocity.textContent = velocity.toFixed(2);
  els.rpm.textContent = (omega * 60 / TAU).toFixed(1);
  els.acceleration.textContent = acceleration.toFixed(1);
  els.gravity.textContent = (acceleration / 9.80665).toFixed(1);
  els.frequency.textContent = (omega / TAU).toFixed(2);
  els.period.textContent = omega > .001 ? (TAU / omega).toFixed(3) : "∞";
  els.angle.textContent = Math.round(state.totalAngle * 180 / Math.PI).toLocaleString("zh-Hant");
  els.energy.textContent = (0.5 * MOMENT_OF_INERTIA * omega ** 2).toFixed(3);

  const elapsed = state.infiniteStartedAt ? (performance.now() - state.infiniteStartedAt) / 1000 : 0;
  let note = "可忽略";
  if (omega > 65) note = "依然可忽略";
  if (elapsed > 30) note = "真的還是可忽略";
  if (elapsed > 60) note = "請諮詢物理科教師";
  els.relativity.querySelector("strong").textContent = note;
}

function updateAvailability() {
  const eligible = eligibleStudentsSilently();
  els.eligibleCount.textContent = `${eligible.length} 位可抽選`;
  els.wheel.setAttribute("aria-label", state.spinning ? (state.infiniteSpin ? "點擊轉盤瞬間停止" : "轉盤正在旋轉") : "點擊轉盤開始抽選");
}

function eligibleStudentsSilently() {
  const active = activeStudents();
  if (state.boostMultiplier === Infinity && active.includes(state.boostStudent)) return [state.boostStudent];
  const eligible = active.filter((student) => !isCooling(student));
  return eligible.length ? eligible : active;
}

function profile(progress) {
  const p = Math.min(1, Math.max(0, progress));
  const accel = .18, steady = .62, totalArea = .72;
  if (p <= accel) return (p * p / (2 * accel)) / totalArea;
  if (p <= steady) return (accel / 2 + (p - accel)) / totalArea;
  const x = p - steady;
  return (accel / 2 + (steady - accel) + x - x * x / (2 * (1 - steady))) / totalArea;
}

function playTone(frequency = 640, duration = .12, volume = .035) {
  if (!els.sound.checked) return;
  try {
    state.audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const now = state.audioContext.currentTime;
    const oscillator = state.audioContext.createOscillator();
    const gain = state.audioContext.createGain();
    oscillator.type = "sine"; oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(state.audioContext.destination); oscillator.start(now); oscillator.stop(now + duration);
  } catch { /* Audio is a non-essential enhancement. */ }
}

function startSpin() {
  if (state.spinning) {
    if (state.infiniteSpin) stopInfiniteSpin();
    return;
  }
  const candidates = eligibleStudents();
  if (!candidates.length) {
    toast("沒有可參與抽選的學生，請先調整排除名單。");
    return;
  }
  state.spinning = true;
  state.infiniteSpin = state.speed === 10;
  state.pendingSelection = null;
  els.wheel.classList.add("spinning");
  els.hub.innerHTML = state.infiniteSpin ? "<strong>極限旋轉中</strong><small>經典力學仍在運作</small>" : "<strong>正在抽選</strong><small>量子決策核心運算中</small>";
  setControlsDisabled(true);
  updateAvailability();
  playTone(220, .16, .025);

  if (state.infiniteSpin) {
    state.infiniteStartedAt = performance.now();
    els.spacePrompt.classList.add("visible");
    runInfiniteSpin();
  } else {
    runNormalSpin(weightedChoice(candidates));
  }
}

function runNormalSpin(selected) {
  const list = sectors();
  const chosen = list.find((sector) => sector.student === selected);
  if (!chosen) { finishWithoutResult(); return; }
  const targetWithinSector = chosen.startOffset + chosen.width * (.3 + randomUnit() * .4);
  const targetModulo = normalized(-targetWithinSector);
  const deltaModulo = normalized(targetModulo - normalized(state.rotation));
  const turns = Math.floor(3 + state.speed * .8 + state.duration * .22 + randomUnit() * 2);
  const delta = turns * TAU + deltaModulo;
  const startRotation = state.rotation;
  const durationMs = state.duration * 1000;
  const started = performance.now();
  let previousTime = started;
  let previousRotation = startRotation;

  const frame = (now) => {
    const progress = Math.min(1, (now - started) / durationMs);
    const nextRotation = startRotation + delta * profile(progress);
    const dt = Math.max(.001, (now - previousTime) / 1000);
    const moved = nextRotation - previousRotation;
    state.rotation = nextRotation;
    state.totalAngle += Math.abs(moved);
    state.omega = Math.abs(moved / dt);
    drawWheel(); telemetry();
    previousTime = now; previousRotation = nextRotation;
    if (progress < 1) state.animationFrame = requestAnimationFrame(frame);
    else {
      state.omega = 0; state.rotation = normalized(state.rotation); telemetry(); drawWheel();
      window.setTimeout(() => commitResult(selected, false), 300);
    }
  };
  state.animationFrame = requestAnimationFrame(frame);
}

function runInfiniteSpin() {
  let previous = performance.now();
  const maximumOmega = 64 + state.speed * 5;
  const frame = (now) => {
    if (!state.spinning || !state.infiniteSpin) return;
    const dt = Math.min(.04, (now - previous) / 1000);
    const elapsed = (now - state.infiniteStartedAt) / 1000;
    state.omega = maximumOmega * Math.min(1, elapsed / .65);
    const moved = state.omega * dt;
    state.rotation = normalized(state.rotation + moved);
    state.totalAngle += moved;
    drawWheel(); telemetry();
    previous = now;
    state.animationFrame = requestAnimationFrame(frame);
  };
  state.animationFrame = requestAnimationFrame(frame);
}

function studentAtPointer() {
  const list = sectors();
  const pointerOffset = normalized(-state.rotation);
  const hit = list.find((sector) => pointerOffset >= sector.startOffset && pointerOffset < sector.endOffset);
  return hit?.student ?? list.at(-1)?.student ?? null;
}

function snapStudentToPointer(student) {
  const chosen = sectors().find((sector) => sector.student === student);
  if (!chosen) return;
  const middle = (chosen.startOffset + chosen.endOffset) / 2;
  state.rotation = normalized(-middle);
}

function stopInfiniteSpin() {
  if (!state.spinning || !state.infiniteSpin) return;
  cancelAnimationFrame(state.animationFrame);
  state.omega = 0;
  state.infiniteSpin = false;
  state.spinning = false;
  els.spacePrompt.classList.remove("visible");
  let selected = studentAtPointer();
  const eligible = eligibleStudentsSilently();
  if (!eligible.includes(selected)) {
    selected = weightedChoice(eligible);
    snapStudentToPointer(selected);
  }
  drawWheel(); telemetry();
  els.hub.innerHTML = "<strong>旋轉已終止</strong><small>停止時間 &lt; 16.7 ms</small>";
  playTone(180, .08, .03);
  window.setTimeout(() => commitResult(selected, true), 300);
}

function commitResult(student, wasInfinite) {
  if (!student) { finishWithoutResult(); return; }
  const draw = { student, round: state.history.length + 1, wasInfinite, multiplier: state.boostMultiplier };
  state.history.push(draw);
  state.pendingSelection = draw;
  state.spinning = false;
  state.infiniteSpin = false;
  state.infiniteStartedAt = 0;
  els.wheel.classList.remove("spinning");
  els.spacePrompt.classList.remove("visible");
  els.hub.innerHTML = `<strong>${padStudent(student)} 號</strong><small>抽選程序完成</small>`;
  setControlsDisabled(false);
  updateAll();
  playTone(784, .14, .05);
  window.setTimeout(() => playTone(988, .25, .035), 110);
  showResult(draw);
}

function finishWithoutResult() {
  state.spinning = false; state.infiniteSpin = false; state.omega = 0;
  els.wheel.classList.remove("spinning"); els.spacePrompt.classList.remove("visible");
  els.hub.innerHTML = "<strong>點擊轉盤</strong><small>開始智能抽選</small>";
  setControlsDisabled(false); telemetry(); drawWheel();
}

function setControlsDisabled(disabled) {
  $$(".settings-section input, .settings-section select, .settings-section button").forEach((control) => {
    if (control.id === "undoButton") control.disabled = disabled || !state.history.length;
    else control.disabled = disabled;
  });
  $$(".premium-card").forEach((control) => { control.disabled = disabled; });
}

function showResult(draw) {
  els.selectedNumber.textContent = padStudent(draw.student);
  els.resultRound.textContent = `第 ${draw.round} 輪`;
  if (draw.multiplier === Infinity) {
    els.resultKicker.textContent = "量子抽選程序完成";
    els.resultMessage.textContent = `經過極其公平且透明的隨機程序，最終結果為 ${padStudent(draw.student)} 號。`;
  } else if (draw.wasInfinite) {
    els.resultKicker.textContent = "極限旋轉已瞬間終止";
    els.resultMessage.textContent = "恭喜，你已在無預警情況下被學術性選中。";
  } else {
    els.resultKicker.textContent = "本輪抽選結果";
    els.resultMessage.textContent = "恭喜，你已被學術性選中。";
  }
  createConfetti();
  openModal(els.resultModal);
}

function createConfetti() {
  const container = $("#confetti");
  container.replaceChildren();
  const colours = ["#0052ff", "#ffd700", "#19b879", "#e85858", "#805bc5"];
  for (let i = 0; i < 44; i += 1) {
    const piece = document.createElement("i");
    piece.style.left = `${5 + randomUnit() * 90}%`;
    piece.style.background = colours[i % colours.length];
    piece.style.setProperty("--fall", `${1.8 + randomUnit() * 1.6}s`);
    piece.style.setProperty("--drift", `${-90 + randomUnit() * 180}px`);
    piece.style.setProperty("--spin", `${180 + randomUnit() * 720}deg`);
    piece.style.animationDelay = `${randomUnit() * .35}s`;
    container.append(piece);
  }
}

function openModal(modal) {
  state.lastFocused = document.activeElement;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => modal.querySelector("button, input, select")?.focus());
}

function closeModal(modal) {
  modal.hidden = true;
  if (!$$(`.modal:not([hidden])`).length) document.body.classList.remove("modal-open");
  state.lastFocused?.focus?.();
}

function renderHistory() {
  if (!state.history.length) {
    els.historyList.innerHTML = '<div class="empty-state"><span>⌁</span><strong>尚未開始抽選</strong><small>第一筆結果將顯示於此</small></div>';
    return;
  }
  els.historyList.innerHTML = [...state.history].reverse().slice(0, 6).map((draw) => {
    const remaining = cooldownRemaining(draw.student);
    return `<div class="history-item"><span class="history-number">${padStudent(draw.student)}</span><span class="history-copy"><strong>第 ${draw.round} 輪・${padStudent(draw.student)} 號</strong><small>${draw.wasInfinite ? "極限旋轉瞬間停止" : "智能抽選程序完成"}</small></span><span class="cooldown-pill ${remaining ? "" : "eligible"}">${remaining ? `鎖定 ${remaining} 輪` : "可再抽選"}</span></div>`;
  }).join("");
}

function renderStats() {
  const active = activeStudents();
  const counts = new Map();
  state.history.forEach((draw) => counts.set(draw.student, (counts.get(draw.student) || 0) + 1));
  const unique = counts.size;
  els.totalRounds.textContent = `${state.history.length} 輪`;
  els.uniqueStudents.textContent = `${unique} 人`;
  els.unselectedStudents.textContent = `${Math.max(0, active.length - unique)} 人`;
  let rating = "正常";
  if (state.boostMultiplier === Infinity) rating = "極具特色";
  else if (state.boostMultiplier >= 5) rating = "高度增益";
  else if (state.boostMultiplier > 1) rating = "專有標準";
  els.fairnessRating.innerHTML = `<span class="status-dot"></span> ${rating}`;
}

function renderDetailedStats() {
  const counts = new Map();
  state.history.forEach((draw) => counts.set(draw.student, (counts.get(draw.student) || 0) + 1));
  const maximum = Math.max(1, ...counts.values());
  const mostSelected = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  els.statsSummary.innerHTML = [
    ["總抽選次數", `${state.history.length} 輪`],
    ["不同學生", `${counts.size} 人`],
    ["最高次數", mostSelected ? `${padStudent(mostSelected[0])} 號 ×${mostSelected[1]}` : "—"],
    ["公平性評級", state.boostMultiplier === Infinity ? "極具特色" : "正常運作"]
  ].map(([label, value]) => `<div class="summary-tile"><small>${label}</small><strong>${value}</strong></div>`).join("");
  els.distribution.innerHTML = Array.from({ length: state.studentCount }, (_, index) => index + 1).map((student) => {
    const count = counts.get(student) || 0;
    const excluded = state.excluded.has(student);
    return `<div class="bar-row"><span>${padStudent(student)}</span><span class="bar-track"><i class="bar-fill" style="width:${excluded ? 0 : count / maximum * 100}%"></i></span><span>${excluded ? "×" : count}</span></div>`;
  }).join("");
}

function renderExcluded() {
  const students = [...state.excluded].sort((a, b) => a - b);
  if (!students.length) {
    els.excludedList.innerHTML = '<span class="empty-chip">目前全員到齊</span>';
    return;
  }
  els.excludedList.innerHTML = students.map((student) => `<span class="chip">${padStudent(student)} <button type="button" data-remove-excluded="${student}" aria-label="讓 ${padStudent(student)} 號重新參與">×</button></span>`).join("");
}

function updateFairness() {
  const student = state.boostStudent;
  const excluded = state.excluded.has(student);
  els.fairAlert.classList.toggle("infinity", state.boostMultiplier === Infinity);
  if (!student) els.fairAlert.textContent = state.boostMultiplier === 1 ? "機率增益目前已關閉；需要時再指定學號和倍率。" : "請先指定要增益的學生學號。";
  else if (excluded) els.fairAlert.textContent = `${padStudent(student)} 號已被排除，機率增益暫不生效。`;
  else if (state.boostMultiplier === Infinity) els.fairAlert.textContent = `${padStudent(student)} 號 = 360°。目前具有經數學驗證的 100% 公平抽中機率。`;
  else if (state.boostMultiplier === 1) els.fairAlert.textContent = "所有可抽選學生目前使用相同基礎權重。";
  else els.fairAlert.textContent = `${padStudent(student)} 號目前擁有其他學生 ${state.boostMultiplier} 倍的公平抽中機率。`;
}

function updateSpeedUI() {
  const labels = ["", "慢速", "舒適", "標準", "標準＋", "快速", "高速", "高速", "極高速", "荒謬高速", "∞ 極限模式"];
  els.speedOutput.textContent = labels[state.speed];
  const infinite = state.speed === 10;
  els.duration.disabled = infinite;
  els.durationOutput.textContent = infinite ? "∞ 手動終止" : `${state.duration} 秒`;
  els.durationDescription.textContent = infinite ? "等待空白鍵或再次點擊轉盤" : "自動減速並停止";
}

function updateAll() {
  renderHistory(); renderStats(); renderExcluded(); updateFairness(); updateSpeedUI(); updateAvailability(); drawWheel(); telemetry();
  els.undo.disabled = state.spinning || !state.history.length;
  els.wheelNote.innerHTML = state.cooldown ? `<span>✓</span> ${state.cooldown} 輪重複抽選保護已啟用` : "重複抽選保護目前已關閉";
}

function resetSession(showToast = true) {
  state.history = [];
  state.rotation = 0;
  state.totalAngle = 0;
  state.omega = 0;
  state.order = shuffle(Array.from({ length: state.studentCount }, (_, index) => index + 1));
  els.hub.innerHTML = "<strong>點擊轉盤</strong><small>開始智能抽選</small>";
  updateAll();
  if (showToast) toast("本節課紀錄及冷卻狀態已重設。");
}

function undoLast(showToast = true) {
  const removed = state.history.pop();
  if (!removed) return null;
  state.history.forEach((draw, index) => { draw.round = index + 1; });
  els.hub.innerHTML = "<strong>點擊轉盤</strong><small>開始智能抽選</small>";
  updateAll();
  if (showToast) toast(`已撤銷第 ${removed.round} 輪（${padStudent(removed.student)} 號）。`);
  return removed;
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast"; node.textContent = message;
  els.toastRegion.append(node);
  window.setTimeout(() => node.remove(), 3100);
}

function openPayment(card) {
  els.paymentFeature.textContent = card.dataset.feature;
  els.paymentPrice.textContent = card.dataset.price;
  resetPaymentView();
  openModal(els.paymentModal);
}

function resetPaymentView() {
  window.clearInterval(state.paymentTimer);
  els.paymentFormView.hidden = false; els.paymentProcess.hidden = true; els.paymentError.hidden = true;
  $("#paymentForm").reset();
  els.processSteps.replaceChildren();
}

function runFakePayment(mode = "standard") {
  els.paymentFormView.hidden = true; els.paymentProcess.hidden = false; els.paymentError.hidden = true;
  const standardLogs = [
    "正在連接 PROnet 教育運算基礎設施……",
    "正在分配量子隨機運算資源……",
    "正在驗證智慧課堂專業版教育授權……",
    "正在部署課堂智能決策模型……"
  ];
  const proxyLogs = [
    "正在連接 PROnet 教育運算基礎設施……",
    "正在建立佳哥名義付款授權……",
    "正在向佳哥發出企業級請款……",
    "正在等待佳哥批准交易……"
  ];
  const logs = mode === "jia" ? proxyLogs : standardLogs;
  $("#paymentErrorMessage").textContent = mode === "jia" ? "佳哥不願意給這個錢。" : "你的帳戶尚未獲指派 PROnet 智慧課堂專業版授權。請聯絡 PROnet 企業客戶經理。";
  $("#paymentErrorCode").textContent = mode === "jia" ? "JIA_GE_PAYMENT_DECLINED" : "PRONET_EDU_PREMIUM_LICENSE_REQUIRED";
  els.processSteps.innerHTML = logs.map(() => "<i></i>").join("");
  let step = 0;
  els.processLog.textContent = logs[0];
  state.paymentTimer = window.setInterval(() => {
    els.processSteps.children[step]?.classList.add("done");
    step += 1;
    if (step < logs.length) els.processLog.textContent = logs[step];
    else {
      window.clearInterval(state.paymentTimer);
      window.setTimeout(() => {
        els.paymentProcess.hidden = true; els.paymentError.hidden = false;
        $("#paymentDone").focus();
      }, 450);
    }
  }, 650);
}

function formatMockCardInput(event) {
  const digits = event.target.value.replace(/\D/g, "").slice(0, 16);
  event.target.value = digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatMockExpiry(event) {
  const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
  event.target.value = digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
}

function wireEvents() {
  els.wheel.addEventListener("click", startSpin);
  document.addEventListener("keydown", (event) => {
    if (event.code === "Space" && state.spinning && state.infiniteSpin) { event.preventDefault(); stopInfiniteSpin(); }
    if (event.key === "Escape") {
      const open = $$(".modal:not([hidden])").at(-1);
      if (open) { if (open === els.paymentModal) resetPaymentView(); closeModal(open); }
    }
  });

  $("#studentMinus").addEventListener("click", () => { els.studentCount.value = state.studentCount - 1; els.studentCount.dispatchEvent(new Event("change")); });
  $("#studentPlus").addEventListener("click", () => { els.studentCount.value = state.studentCount + 1; els.studentCount.dispatchEvent(new Event("change")); });
  els.studentCount.addEventListener("change", () => {
    state.studentCount = clampInput(els.studentCount, 2, 100, state.studentCount);
    state.excluded = new Set([...state.excluded].filter((student) => student <= state.studentCount));
    state.boostStudent = state.boostStudent ? Math.min(state.boostStudent, state.studentCount) : null;
    els.boostStudent.max = state.studentCount; els.excludedInput.max = state.studentCount;
    resetSession(false); toast(`學生人數已設為 ${state.studentCount} 人；本節課紀錄已重新開始。`);
  });
  els.speed.addEventListener("input", () => { state.speed = Number(els.speed.value); updateSpeedUI(); });
  els.duration.addEventListener("input", () => { state.duration = Number(els.duration.value); updateSpeedUI(); });
  els.cooldown.addEventListener("change", () => { state.cooldown = clampInput(els.cooldown, 0, 10, 3); updateAll(); });
  els.boostStudent.addEventListener("change", () => { state.boostStudent = els.boostStudent.value === "" ? null : clampInput(els.boostStudent, 1, state.studentCount, 1); updateAll(); });
  els.boostMultiplier.addEventListener("change", () => { state.boostMultiplier = els.boostMultiplier.value === "infinity" ? Infinity : Number(els.boostMultiplier.value); updateAll(); });

  $("#excludeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const student = Number.parseInt(els.excludedInput.value, 10);
    if (!Number.isInteger(student) || student < 1 || student > state.studentCount) { toast(`請輸入 1–${state.studentCount} 之間的學號。`); return; }
    if (state.excluded.has(student)) { toast(`${padStudent(student)} 號已在排除名單中。`); return; }
    state.excluded.add(student); els.excludedInput.value = ""; updateAll(); toast(`${padStudent(student)} 號本節課不參與抽選。`);
  });
  els.excludedList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-excluded]");
    if (!button) return;
    const student = Number(button.dataset.removeExcluded); state.excluded.delete(student); updateAll(); toast(`${padStudent(student)} 號已重新加入抽選。`);
  });
  $("#clearExcluded").addEventListener("click", () => { state.excluded.clear(); updateAll(); toast("排除名單已清除：今日全員到齊。"); });
  els.undo.addEventListener("click", () => undoLast());
  $("#resetButton").addEventListener("click", () => resetSession());

  $("#continueButton").addEventListener("click", () => closeModal(els.resultModal));
  $("#redrawButton").addEventListener("click", () => { undoLast(false); closeModal(els.resultModal); window.setTimeout(startSpin, 180); });
  $("#statsButton").addEventListener("click", () => { renderDetailedStats(); openModal(els.statsModal); });
  $$('[data-close="result"]').forEach((node) => node.addEventListener("click", () => closeModal(els.resultModal)));
  $$('[data-close="stats"]').forEach((node) => node.addEventListener("click", () => closeModal(els.statsModal)));
  $$('[data-close="payment"]').forEach((node) => node.addEventListener("click", () => { resetPaymentView(); closeModal(els.paymentModal); }));

  $$(".premium-card").forEach((card) => card.addEventListener("click", () => openPayment(card)));
  $("#paymentForm").addEventListener("submit", (event) => { event.preventDefault(); runFakePayment("standard"); });
  $("#jiaPurchaseButton").addEventListener("click", () => runFakePayment("jia"));
  $("#paymentForm input[inputmode='numeric'][maxlength='19']").addEventListener("input", formatMockCardInput);
  $("#paymentForm input[placeholder='MM / YY']").addEventListener("input", formatMockExpiry);
  $("#paymentDone").addEventListener("click", () => { resetPaymentView(); closeModal(els.paymentModal); });

  $("#accountButton").addEventListener("click", () => {
    window.clearTimeout(state.accountClickTimer);
    state.accountClicks += 1;
    if (state.accountClicks >= 7) {
      state.accountClicks = 0; state.developerMode = !state.developerMode;
      els.developerRow.classList.toggle("visible", state.developerMode);
      toast(`博博開發者模式已${state.developerMode ? "啟用" : "停用"}。`);
    } else state.accountClickTimer = window.setTimeout(() => { state.accountClicks = 0; }, 1600);
  });

  new ResizeObserver(resizeCanvas).observe(els.wheel);
}

function initialise() {
  els.studentCount.value = state.studentCount; els.cooldown.value = state.cooldown; els.speed.value = state.speed; els.duration.value = state.duration;
  state.boostStudent = null; els.boostStudent.value = ""; els.boostStudent.max = state.studentCount; els.excludedInput.max = state.studentCount;
  state.order = shuffle(Array.from({ length: state.studentCount }, (_, index) => index + 1));
  wireEvents(); updateAll();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(() => {});
}

initialise();
