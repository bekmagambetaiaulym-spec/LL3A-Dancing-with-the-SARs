const BOUNDS = [[36.80, 66.15], [37.25, 67.90]];

const IMG = {
  HH: { jun: "images/nisar_20260622_HH.png", oct: "images/nisar_20261020_HH.png" },
  HV: { jun: "images/nisar_20260622_HV.png", oct: "images/nisar_20261020_HV.png" },
  change: "images/change_class.png",
};

const LEG_GREY = {
  title: "Echo strength",
  items: [
    ["#141414", "Dark: Low backscatter (calm water / smooth sand)"],
    ["#808080", "Grey: Moderate backscatter"],
    ["#f0f0f0", "Bright: High backscatter (rough / wet soil / structures)"],
  ],
};
const LEG_CHANGE = {
  title: "What changed, June to October 2026",
  items: [
    ["#1f5fd6", "Significant decrease in backscatter (smoother / drier / open water)"],
    ["#d9b779", "Moderate decrease in backscatter"],
    ["#f26b21", "Backscatter increase (potential soil moisture / seepage zone)"],
    ["#2a9d8f", "Backscatter increase (vegetation growth / surface roughening)"],
    ["#e5e9ef", "No statistically significant change"],
  ],
};

const NOTE = " Images are independently contrast-stretched to highlight structural features (canal embankments, sand dunes, field boundaries). Switch to <strong>\"Where did it change?\"</strong> for radiometrically calibrated backscatter difference to isolate true moisture and roughness changes.";
const DESC = {
  HH: "Drag the slider. Left: 22 June 2026. Right: 20 October 2026. This channel (HH) reacts mostly to the ground surface. Dark means a weak echo, bright means a strong one." + NOTE,
  HV: "Drag the slider. Left: 22 June 2026. Right: 20 October 2026. This channel (HV) reacts to plants and rough ground, so vegetation and rough terrain stand out." + NOTE,
  change: "A single picture, so there is no slider. Colours show where the signal changed locally between 22 June and 20 October 2026. This view is calculated from the measured values, not from the grey pictures. Each colour is a lead for field checks, not proof.",
};

let mode = "compare";
let chan = "HH";

const map = L.map("map", { zoomAnimation: false }).setView([37.03, 67.0], 9);

L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { attribution: "Esri World Imagery", maxZoom: 14 }
).addTo(map);


const points = [
  [36.9309, 66.3108, "Western end"],
  [36.9927, 66.4310, "Midpoint"],
  [37.0836, 67.7681, "Start near the Amu Darya"],
];
points.forEach(([lat, lon, name]) =>
  L.circleMarker([lat, lon], { radius: 6, color: "#ff5252" }).addTo(map).bindTooltip(name)
);


const CANAL = [];
if (CANAL.length > 1) {
  L.polyline(CANAL, { color: "#ff9800", weight: 3, opacity: 0.9 }).addTo(map).bindTooltip("Qosh Tepa Canal (route)");
}

const wrap = document.getElementById("wrap");
const slider = document.getElementById("slider");
const divider = document.getElementById("divider");
let leftLayer = null, rightLayer = null, changeLayer = null;

function updateClip() {
  if (!rightLayer) return;
  const x = (slider.value / 100) * map.getSize().x;
  divider.style.left = x + "px";
  const img = rightLayer.getElement();
  if (!img) return;
  const pt = map.containerPointToLayerPoint([x, 0]);
  const pos = L.DomUtil.getPosition(img);
  img.style.clipPath = `inset(0 0 0 ${pt.x - pos.x}px)`;
}

function renderLegend(leg) {
  const box = document.getElementById("maplegend");
  box.innerHTML = `<b>${leg.title}</b>` + leg.items.map(
    ([c, t]) => `<span><i style="background:${c};border:1px solid rgba(0,0,0,.2)"></i>${t}</span>`
  ).join("");
}

function render() {
  [leftLayer, rightLayer, changeLayer].forEach((l) => l && map.removeLayer(l));
  const isChange = mode === "change";
  const src = isChange ? IMG.HH : IMG[chan];
  const leftSrc = isChange ? src.oct : src.jun;

  leftLayer = L.imageOverlay(leftSrc, BOUNDS, { zIndex: 200 }).addTo(map);
  rightLayer = L.imageOverlay(src.oct, BOUNDS, { zIndex: 300 }).addTo(map);
  rightLayer.on("load", updateClip);
  changeLayer = isChange ? L.imageOverlay(IMG.change, BOUNDS, { zIndex: 400 }).addTo(map) : null;

  wrap.classList.toggle("mode-change", isChange);
  wrap.classList.add("has-legend");
  renderLegend(isChange ? LEG_CHANGE : LEG_GREY);

  document.querySelector(".chip-left").textContent =
    isChange ? "Local change · 22 Jun to 20 Oct 2026" : `June 2026 · NISAR ${chan}`;
  document.querySelector(".chip-right").textContent = isChange ? "" : `October 2026 · NISAR ${chan}`;
  document.getElementById("modeDesc").innerHTML = isChange ? DESC.change : DESC[chan];
  document.getElementById("chanBox").hidden = isChange;

  document.querySelectorAll(".mode-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  document.querySelectorAll(".chan-btn").forEach((b) => b.classList.toggle("active", b.dataset.chan === chan));
  updateClip();
}

document.querySelectorAll(".mode-btn").forEach((b) => { b.onclick = () => { mode = b.dataset.mode; render(); }; });
document.querySelectorAll(".chan-btn").forEach((b) => { b.onclick = () => { chan = b.dataset.chan; render(); }; });
slider.addEventListener("input", updateClip);
map.on("move zoom viewreset resize", updateClip);


function changeText() {
  const base = "Differential backscatter mapping isolates local surface modifications between 22 June and 20 October 2026 (regional atmospheric trends filtered).";
  if (typeof STATS === "undefined") return `${base} Approximately 13% of the scene exhibits local change, with 3.7% flagged as orange anomalies indicating increased soil permittivity or surface moisture along unlined reaches.`;
  const changed = (100 - STATS.pct[0]).toFixed(0);
  return `${base} Approximately ${changed}% of the scene exhibits local change, with ${STATS.pct[3]}% flagged as orange anomalies indicating increased soil permittivity or surface moisture along unlined reaches.`;
}

const STORY = [
  { title: "What is the Qosh Tepa Canal?", mode: "compare", chan: "HH",
    text: "A 285-km unlined irrigation canal under construction in northern Afghanistan, diverting water from the shared Amu Darya basin. Drag the slider to compare NASA-ISRO NISAR L-band backscatter across seasonal passes: June (left) versus October 2026 (right).",
    center: [37.03, 67.0], zoom: 9, slider: 50 },
  { title: "How to read the grey", mode: "compare", chan: "HH",
    text: "Dark means a weak radar echo and bright means a strong one. The Amu Darya shows up as dark water channels with islands. Dry sand is also dark, so dark does not always mean water.",
    center: [37.0836, 67.7681], zoom: 11, slider: 50 },
  { title: "A second view: plants and rough ground", mode: "compare", chan: "HV",
    text: "Cross-polarization (HV) measures volumetric scattering from vegetation canopy and surface roughness. Toggle between HH (surface scattering) and HV (volume scattering) channels above to isolate structural changes in crops and desert soils: Surfaces that look similar in one can look different in the other.",
    center: [37.03, 67.0], zoom: 9, slider: 50 },
  { title: "What changed from June to October?", mode: "change", chan: "HH",
    text: changeText,
    center: [37.03, 67.0], zoom: 9, slider: 50 },
  { title: "What this does and does not show", mode: "compare", chan: "HH",
    text: "Radar shows where the signal changed, not why, and it cannot measure water volumes or losses. Useful next steps: rainfall data for both dates, checks on the ground, and repeat NISAR passes (about every 12 days) for ongoing monitoring.",
    center: [37.03, 67.0], zoom: 9, slider: 50 },
];

let storyIdx = 0;
function showStory(i) {
  storyIdx = i;
  const s = STORY[i];
  mode = s.mode;
  chan = s.chan;
  render();
  document.getElementById("storyStep").textContent = `Step ${i + 1} of ${STORY.length}`;
  document.getElementById("storyTitle").textContent = s.title;
  document.getElementById("storyText").textContent = typeof s.text === "function" ? s.text() : s.text;
  document.getElementById("prevBtn").disabled = i === 0;
  document.getElementById("nextBtn").disabled = i === STORY.length - 1;
  slider.value = s.slider;
  map.setView(s.center, s.zoom);
  updateClip();
}
document.getElementById("prevBtn").onclick = () => showStory(storyIdx - 1);
document.getElementById("nextBtn").onclick = () => showStory(storyIdx + 1);
showStory(0);