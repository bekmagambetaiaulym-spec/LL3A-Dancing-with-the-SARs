(function(){
const $=s=>document.querySelector(s);

const PATH=[
 {ico:"🛰️",lab:"Leaking channel",tag:"Where: canal banks, northern Afghanistan",
  h:"Stage 1: A canal with no lining, in sand",
  p:"The canal takes water from the Amu Darya and carries it through porous desert soil. In the calibrated change view (orange highlights), elevated L-band backscatter appears along unlined desert embankments between June and October - a primary indicator of increased soil dielectric constant (moisture) or surface disturbance.",
  so:"What it means: some of the water may be soaking into the ground before it reaches any field. Radar points to where to look. It cannot measure how much."},
 {ico:"🌾",lab:"Afghan farmland",tag:"Where: Balkh, Jowzjan and Faryab provinces",
  h:"Stage 2: New farmland, with a catch",
  p:"The canal aims to irrigate roughly 550,000 hectares of arid land across Balkh, Jowzjan, and Faryab. Yet unlined seepage raises the shallow water table, drawing salts to the surface - a process (waterlogging and salinization) that degrades soil fertility and alters surface dielectric properties detectable by L-band radar.",
  so:"What it means: uncontrolled seepage can also damage the land the canal is meant to serve."},
 {ico:"📉",lab:"Less downstream",tag:"Where: the whole Amu Darya basin",
  h:"Stage 3: Less water for everyone downstream",
  p:"In a closed transboundary basin, water diverted or lost to seepage upstream directly reduces dry-season flows for downstream agriculture in Uzbekistan and Turkmenistan, as well as the fragile Aral Sea wetlands, affecting Central Asia as a whole. Estimates suggest the canal could divert up to 15–20% of the Amu Darya’s flow.",
  so:"<strong>What it means:</strong> Localized canal seepage becomes a basin-wide water security challenge, intensifying irrigation deficits across downstream communities in Central Asia."},
 {ico:"🤝",lab:"Shared decisions",tag:"Action: targeted lining, joint monitoring",
  h:"Stage 4: What decision-makers can do",
  p:"NISAR’s 12-day repeat cycle enables consistent, year-round tracking. Instead of costly full-length concrete lining, engineers can flag persistent wet-soil anomalies, verify them on the ground, line high-risk sections first, and monitor post-repair recovery using open-access radar data.",
  so:"<strong>What it means:</strong> Transparent, reproducible satellite observations provide a shared technical baseline for transboundary water dialogue - replacing disputed estimates with verifiable evidence."}
];
const svgNS="http://www.w3.org/2000/svg";
const P="M70,50 L470,50 C560,50 560,170 470,170 L70,170";
let pi=0,nodes=[];
function buildSnake(){
 const box=$("#snake");
 box.innerHTML=`<svg viewBox="0 0 600 230" role="group" aria-label="Impact pathway"><path class="base" d="${P}"/><path class="flow" id="flow" d="${P}"/><g id="nodes"></g></svg>`;
 const flow=$("#flow"),len=flow.getTotalLength();
 flow.style.strokeDasharray=len;flow.style.strokeDashoffset=len;
 const fr=[0,.36,.64,1];
 const g=$("#nodes");
 PATH.forEach((s,i)=>{
  const pt=flow.getPointAtLength(len*fr[i]);
  const n=document.createElementNS(svgNS,"g");
  n.setAttribute("class","node");n.setAttribute("tabindex","0");n.setAttribute("role","button");
  n.setAttribute("aria-label",s.lab);
  n.setAttribute("transform",`translate(${pt.x},${pt.y})`);
  n.innerHTML=`<circle r="28"/><text class="ico">${s.ico}</text><text class="lab" y="46">${i+1}. ${s.lab}</text>`;
  n.onclick=()=>go(i);
  n.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go(i)}};
  g.appendChild(n);nodes.push(n);
 });
 box._len=len;box._fr=fr;
}
function go(i){
 pi=i;const s=PATH[i],box=$("#snake");
 $("#flow").style.strokeDashoffset=box._len*(1-box._fr[i]);
 nodes.forEach((n,k)=>{n.classList.toggle("on",k===i);n.classList.toggle("done",k<i)});
 $("#detail").innerHTML=`<span class="tagline">${s.tag}</span><h3>${s.h}</h3><p>${s.p}</p><p class="so">${s.so}</p>
  <div class="nav"><button id="pp" ${i===0?"disabled":""}>← Back</button><button class="go" id="pn" ${i===PATH.length-1?"disabled":""}>Next →</button></div>`;
 $("#pp").onclick=()=>go(pi-1);$("#pn").onclick=()=>go(pi+1);
}
buildSnake();go(0);
})();

(function(){
const terrainData={
 water:{
  title:"Calm Canal Water",
  level:"Usually weak return",
  strength:"low",
  color:"#8fb4c5",
  note:"<strong>Canal signature:</strong> Confirms water presence in completed sections; wind-induced ripples can shift dark specular reflection into bright Bragg scattering.",
  explanation:"A smooth water surface often reflects the radar pulse away from the satellite, so little energy returns and the surface can look dark. Wind, waves, or banks can change the echo.",
  desc:"A satellite sends a radar pulse toward calm water and receives a weak echo."
 },
 sand:{
  title:"Dry Desert Sand",
  level:"Often weak return",
  strength:"low",
  color:"#d7bf98",
  note:"<strong>Canal signature:</strong> Surrounding Karakum/Balkh sands act as a dark baseline; L-band (~24 cm wavelength) can even penetrate dry top sand up to tens of centimeters.",
  explanation:"Very dry, smooth sand can also return little energy and look dark—much like calm water. Grain size, crusts, stones, and dunes can make the echo brighter, so darkness alone cannot identify water.",
  desc:"A satellite sends a radar pulse toward dry desert sand and receives a generally weak, variable echo."
 },
 seepage:{
  title:"Wet Seepage Halo",
  level:"Can strengthen the return",
  strength:"medium",
  color:"#a8c9b9",
  note:"<strong>Canal signature:</strong> Lateral water infiltration raises soil permittivity, creating a bright corridor flanking the canal banks—especially visible in <strong>HH polarization</strong>.",
  explanation:"Moisture changes the soil's electrical properties and can increase the return, especially where the ground is rough. A wet-looking halo is a place to investigate, not proof of canal leakage; rain and soil texture also matter.",
  desc:"A satellite sends a radar pulse toward potentially damp soil and receives a moderate, condition-dependent echo."
 },
 crops:{
  title:"Crops & Rough Soil",
  level:"Often a stronger return",
  strength:"high",
  color:"#98ae83",
  note:"<strong>Canal signature:</strong> Differentiates irrigated agricultural expansion (high <strong>HV</strong> volume scattering) from bare soil seepage (high <strong>HH</strong> surface scattering).",
  explanation:"Rough clods and plants scatter energy back in many directions. L-band can interact with larger plant structures and, in some vegetation, reach parts of the canopy or ground; crop type, growth, and moisture all affect the signal.",
  desc:"A satellite sends a radar pulse toward crops and rough soil and receives a stronger, variable echo."
 }
};
const visual=document.getElementById("radarVisual");
if(visual){
 const title=document.getElementById("terrainTitle");
 const explanation=document.getElementById("terrainExplanation");
 const note=document.getElementById("decoderNote");
 const swatch=document.getElementById("surfaceSwatch");
 const level=document.getElementById("signalLevel");
 const diagramTitle=document.getElementById("radarDiagramTitle");
 const diagramDesc=document.getElementById("radarDiagramDesc");
 function selectTerrain(key){
  const terrain=terrainData[key];
  if(!terrain)return;
  visual.dataset.surface=key;
  visual.dataset.strength=terrain.strength;
  title.textContent=terrain.title;
  explanation.textContent=terrain.explanation;
  note.innerHTML=terrain.note;
  swatch.style.backgroundColor=terrain.color;
  level.textContent=terrain.level;
  diagramTitle.textContent=`Radar echo from ${terrain.title.toLowerCase()}`;
  diagramDesc.textContent=terrain.desc;
  document.querySelectorAll(".terrain-btn").forEach(button=>{
   const selected=button.dataset.terrain===key;
   button.classList.toggle("active",selected);
   button.setAttribute("aria-pressed",String(selected));
  });
  visual.classList.remove("is-animating");
  void visual.offsetWidth;
  visual.classList.add("is-animating");
  window.setTimeout(()=>visual.classList.remove("is-animating"),1000);
 }
 document.querySelectorAll(".terrain-btn").forEach(button=>{
  button.addEventListener("click",()=>selectTerrain(button.dataset.terrain));
 });
 selectTerrain("water");
}

const cards=Array.from(document.querySelectorAll(".evidence-card"));
const viewport=document.getElementById("deckViewport");
const counter=document.getElementById("deckCount");
if(cards.length&&viewport&&counter){
 let active=0;
 function renderDeck(){
  const stride=cards[0].getBoundingClientRect().width+20;
  cards.forEach((card,index)=>{
   let distance=(index-active+cards.length)%cards.length;
   if(distance>cards.length/2)distance-=cards.length;
   const selected=distance===0;
   card.style.transform=`translateX(calc(-50% + ${distance*stride}px))`;
   card.style.opacity=selected?"1":".45";
   card.style.filter=selected?"none":"blur(.35px)";
   card.style.zIndex=selected?"2":"1";
   card.setAttribute("aria-current",String(selected));
  });
  counter.textContent=`${String(active+1).padStart(2,"0")} / ${String(cards.length).padStart(2,"0")}`;
 }
 function moveDeck(direction){
  active=(active+direction+cards.length)%cards.length;
  renderDeck();
 }
 document.getElementById("deckPrev").addEventListener("click",()=>moveDeck(-1));
 document.getElementById("deckNext").addEventListener("click",()=>moveDeck(1));
 cards.forEach((card,index)=>{
  card.addEventListener("click",()=>{
   if(index===active)return;
   const next=(index-active+cards.length)%cards.length;
   moveDeck(next===1?1:-1);
  });
  card.addEventListener("keydown",event=>{
   if(event.key==="Enter"||event.key===" "){
    event.preventDefault();
    card.click();
   }
  });
 });
 window.addEventListener("resize",renderDeck);
 renderDeck();
}
})();