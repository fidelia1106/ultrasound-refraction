/* ===== 数据表（cS=null 表示流体无横波） ===== */
const SPEED_TABLE = {
  "钢": { cL: 5900, cS: 3230 },
  "钢轨(碳钢)": { cL: 5900, cS: 3230 },
  "铝": { cL: 6320, cS: 3130 },
  "铜": { cL: 4760, cS: 2320 },
  "黄铜": { cL: 4700, cS: 2100 },
  "钛合金": { cL: 6100, cS: 3120 },
  "不锈钢": { cL: 5790, cS: 3100 },
  "铸铁": { cL: 4500, cS: 2500 },
  "镍基合金": { cL: 5800, cS: 3000 },
  "玻璃": { cL: 5600, cS: 3400 },
  "陶瓷(氧化铝)": { cL: 10000, cS: 6000 },
  "有机玻璃": { cL: 2730, cS: 1340 },
  "环氧树脂": { cL: 2500, cS: 1200 },
  "聚乙烯": { cL: 1950, cS: 650 },
  "混凝土": { cL: 3200, cS: 1800 },
  "水": { cL: 1480, cS: null },
  "机油": { cL: 1400, cS: null },
  "空气": { cL: 343, cS: null }
};

const el = (id)=>document.getElementById(id);
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const fmt = (x)=> (x==null || !Number.isFinite(x)) ? "—" : (Math.round(x*10)/10).toString();

/* ===== HTML 下标工具（公式、文字说明用）===== */
const subHTML = (main, sub)=> `${main}<sub class="sub">${sub}</sub>`;
const symHTML = (sym)=> {
  // 解析形如 "αL" "βS" "γL" "α1" "cL1" 等
  const m = /^([αβγc])([A-Za-z0-9]+)$/.exec(sym);
  if (!m) return sym;
  return subHTML(m[1], m[2]);
};
const sinSymHTML = (sym)=> `sin&nbsp;${symHTML(sym)}`;

/* ===== 介质下拉初始化 ===== */
function populateMaterialSelects(){
  const names = Object.keys(SPEED_TABLE);
  const s1 = el("mat1");
  const s2 = el("mat2");
  for (const s of [s1, s2]){
    s.innerHTML = "";
    for (const name of names){
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      s.appendChild(opt);
    }
  }
  s1.value = SPEED_TABLE["有机玻璃"] ? "有机玻璃" : names[0];
  s2.value = SPEED_TABLE["钢"] ? "钢" : names[0];

  if (el("mat1BtnName")) el("mat1BtnName").textContent = s1.value;
  if (el("mat2BtnName")) el("mat2BtnName").textContent = s2.value;
}

function openModal(modalId){
  el("modalOverlay").hidden = false;
  el(modalId).hidden = false;
}
function closeModals(){
  el("modalOverlay").hidden = true;
  for (const id of ["modalMat1","modalMat2"]){
    const m = el(id);
    if (m) m.hidden = true;
  }
}
function bindMaterialButtons(){
  const b1 = el("btnMat1");
  const b2 = el("btnMat2");
  if (b1) b1.addEventListener("click", ()=>openModal("modalMat1"));
  if (b2) b2.addEventListener("click", ()=>openModal("modalMat2"));
  const ov = el("modalOverlay");
  if (ov) ov.addEventListener("click", closeModals);
  document.querySelectorAll(".modalClose").forEach(btn=>{
    btn.addEventListener("click", closeModals);
  });
}

/* ===== 角度入口 ===== */
let suppressAlpha = false;
function setAlpha(alphaDeg){
  const t = clamp(Number(alphaDeg), 0, 90);
  suppressAlpha = true;
  el("alphaInput").value = String(t);
  suppressAlpha = false;
  computeAndRender();
}

function getParams(){
  const mat1 = el("mat1").value;
  const mat2 = el("mat2").value;
  const s1 = SPEED_TABLE[mat1] || {cL:null, cS:null};
  const s2 = SPEED_TABLE[mat2] || {cL:null, cS:null};

  const incType = el("incType").value; // "L" | "S"
  const alphaDeg = Number(el("alphaInput").value);

  return { mat1, mat2, s1, s2, incType, alphaDeg };
}

function enforceIncTypeAvailability(p){
  const optS = el("incType").querySelector('option[value="S"]');
  const canS = (p.s1.cS != null && Number.isFinite(p.s1.cS) && p.s1.cS > 0);
  optS.disabled = !canS;
  optS.title = canS ? "" : "当前介质1不支持横波（cS1 不存在）";
  if (!canS && el("incType").value === "S") el("incType").value = "L";

  // 下标显示：αL / αS
  el("alphaLabel").innerHTML = (el("incType").value === "S")
    ? `入射角 ${subHTML("α","S")}（°）`
    : `入射角 ${subHTML("α","L")}（°）`;
}

function setSpeedsUI(p){
  el("cL1").textContent = (p.s1.cL ?? "—");
  el("cS1").textContent = (p.s1.cS ?? "—");
  el("cL2").textContent = (p.s2.cL ?? "—");
  el("cS2").textContent = (p.s2.cS ?? "—");

  if (el("mat1BtnName")) el("mat1BtnName").textContent = p.mat1;
  if (el("mat2BtnName")) el("mat2BtnName").textContent = p.mat2;

  const n1 = el("mat1Note");
  const n2 = el("mat2Note");
  if (n1) n1.textContent = (p.s1.cS == null) ? "该介质为流体（或近似流体），不支持横波。" : "";
  if (n2) n2.textContent = (p.s2.cS == null) ? "该介质为流体（或近似流体），不支持横波。" : "";
}

/* ===== 公式渲染：全部下标化 ===== */
function renderLaws(p){
  const isIncS = (el("incType").value === "S");

  // 反射定律：介质1
  const refl = isIncS
    ? [
        { top: sinSymHTML("αS"), bot: symHTML("cS1") },
        { top: sinSymHTML("γL"), bot: symHTML("cL1") },
        { top: sinSymHTML("γS"), bot: symHTML("cS1") },
      ]
    : [
        { top: sinSymHTML("αL"), bot: symHTML("cL1") },
        { top: sinSymHTML("γL"), bot: symHTML("cL1") },
        { top: sinSymHTML("γS"), bot: symHTML("cS1") },
      ];

  // 折射定律：介质2
  const refr = isIncS
    ? [
        { top: sinSymHTML("αS"), bot: symHTML("cS1") },
        { top: sinSymHTML("βL"), bot: symHTML("cL2") },
        { top: sinSymHTML("βS"), bot: symHTML("cS2") },
      ]
    : [
        { top: sinSymHTML("αL"), bot: symHTML("cL1") },
        { top: sinSymHTML("βL"), bot: symHTML("cL2") },
        { top: sinSymHTML("βS"), bot: symHTML("cS2") },
      ];

  const renderChain = (arr)=>arr.map((f,i)=>{
    const frac = `
      <span class="frac">
        <span class="top">${f.top}</span>
        <span class="bar"></span>
        <span class="bot">${f.bot}</span>
      </span>`;
    return (i===0) ? frac : (`<span class="eq">=</span>` + frac);
  }).join("");

  el("reflectEq").innerHTML = renderChain(refl);
  el("refractEq").innerHTML = renderChain(refr);

  el("reflectLegend").innerHTML = "";
  el("refractLegend").innerHTML = "";

  el("symbolLegend").innerHTML = `
      <span class="line">${symHTML("cL1")}、${symHTML("cL2")} —— 两介质的纵波声速</span>
      <span class="line">${symHTML("cS1")}、${symHTML("cS2")} —— 两介质的横波声速</span>
      <span class="line">${symHTML("γL")}、${symHTML("γS")} —— 纵/横波反射角</span>
      <span class="line">${symHTML("βL")}、${symHTML("βS")} —— 纵/横波折射角</span>
      <span class="line">${symHTML("αL")}、${symHTML("αS")} —— 纵/横波入射角</span>
    `;
}

/* ===== 计算 + UI输出 + 触发绘制 ===== */
let LAST_ALL = null;
let LAST_P = null;

function computeAndRender(){
  const p0 = getParams();
  enforceIncTypeAvailability(p0);
  const p = getParams();

  setSpeedsUI(p);
  renderLaws(p);

  const all = UltrasonicPhysics.computeAll({
    incType: p.incType,
    alphaDeg: p.alphaDeg,
    cL1: p.s1.cL,
    cS1: p.s1.cS,
    cL2: p.s2.cL,
    cS2: p.s2.cS,
  });

  el("alpha1Out").textContent = fmt(all.alpha1);
  el("alpha2Out").textContent = fmt(all.alpha2);
  el("alpha3Out").textContent = fmt(all.alpha3);

  el("gammaLOut").textContent = fmt(all.gammaL);
  el("gammaSOut").textContent = fmt(all.gammaS);
  el("betaLOut").textContent = fmt(all.betaL);
  el("betaSOut").textContent = fmt(all.betaS);

  LAST_ALL = all;
  LAST_P = p;
}

/* ===== 输入事件 ===== */
el("alphaInput").addEventListener("input", ()=>{
  if (suppressAlpha) return;
  setAlpha(el("alphaInput").value);
});
el("alphaInput").addEventListener("keydown", (e)=>{
  if (e.key === "Enter"){
    e.preventDefault();
    setAlpha(el("alphaInput").value);
  }
});

/* ===== 抽屉 ===== */
const drawer = el("drawer");
function openDrawer(){ drawer.classList.add("open"); }
function closeDrawer(){ drawer.classList.remove("open"); }
el("btnFormula").addEventListener("click", ()=>{ openDrawer(); });

// 临界角抽屉
const drawerCritical = el("drawerCritical");
function openCritical(){ drawerCritical.classList.add("open"); }
function closeCritical(){ drawerCritical.classList.remove("open"); }
if (el("btnCritical")) el("btnCritical").addEventListener("click", ()=>{ openCritical(); });
if (el("btnCloseCritical")) el("btnCloseCritical").addEventListener("click", ()=> closeCritical());
el("btnCloseDrawer").addEventListener("click", ()=> closeDrawer());
document.addEventListener("keydown", (e)=>{
  if (e.key === "Escape") closeDrawer();

  if (e.key === "Escape") closeCritical();
});

el("mat1").addEventListener("change", computeAndRender);
el("mat2").addEventListener("change", computeAndRender);
el("incType").addEventListener("change", computeAndRender);

/* ===== Canvas 绘制 ===== */
const canvas = el("scene");
const wrap = el("canvasWrap");
const ctx = canvas.getContext("2d");

const CSS = getComputedStyle(document.documentElement);
const COLOR = {
  m1: CSS.getPropertyValue("--m1").trim(),
  m2: CSS.getPropertyValue("--m2").trim(),
  normal: CSS.getPropertyValue("--normal").trim(),
  incL: CSS.getPropertyValue("--incL").trim(),
  incS: CSS.getPropertyValue("--incS").trim(),
  L: CSS.getPropertyValue("--L").trim(),
  S: CSS.getPropertyValue("--S").trim(),
  rL: CSS.getPropertyValue("--rL").trim(),
  rS: CSS.getPropertyValue("--rS").trim(),
};

const state = {
  W: 900, H: 675,
  interfaceY: 350,
  px: 450, py: 350,
  incSeg: null,
  startMs: performance.now(),
  hoverInc: false,
};

function resizeCanvasToWrap(){
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = wrap.getBoundingClientRect();

  // 关键：布局未稳定时（尺寸为 0/极小）不要重置画布，否则会导致绘制区域塌陷
  if (rect.width < 20 || rect.height < 20) return false;

  const w = Math.round(rect.width);
  const h = Math.round(rect.height);

  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);

  state.W = w;
  state.H = h;
  state.interfaceY = Math.round(h * 0.52);
  state.px = Math.round(w * 0.50);
  state.py = state.interfaceY;



  // UI 叠层响应式缩放（以画布容器宽度为准，适配云创/书城嵌入小窗口）
  const uiScale = (w <= 620) ? 0.72
                : (w <= 720) ? 0.78
                : (w <= 900) ? 0.85
                : (w <= 1100)? 0.92
                : 1;
  document.documentElement.style.setProperty('--uiScale', String(uiScale));

  wrap.style.setProperty('--interfaceY', `${state.interfaceY}px`);
  return true;
}

const ro = new ResizeObserver(()=>{ resizeCanvasToWrap(); });
ro.observe(wrap);
window.addEventListener("resize", resizeCanvasToWrap);

function drawDashedLine(x1,y1,x2,y2,color){
  ctx.save();
  ctx.setLineDash([8,7]);
  ctx.strokeStyle=color;
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function labelText(text, x, y, color, jobs){
  // 文字统一最后绘制，避免被波形压住
  if (Array.isArray(jobs)){
    jobs.push({text, x, y, color});
    return;
  }
  ctx.save();
  ctx.font="18px Microsoft YaHei";
  ctx.lineWidth=5;
  ctx.strokeStyle="rgba(255,255,255,0.92)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle=color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/* ===== Canvas：下标绘制（主字更大，下标稍小但清晰）===== */
function parseSubToken(token){
  const m = /^([αβγc])([A-Za-z0-9]+)$/.exec(token);
  if (!m) return null;
  return { main: m[1], sub: m[2] };
}

function drawTextWithSub(ctx, token, x, y, color, opts = {}){
  const parsed = parseSubToken(token);
  if (!parsed){
    // fallback 普通描边填充
    ctx.save();
    ctx.font = opts.fontMain || "16px Microsoft YaHei";
    ctx.lineWidth = opts.strokeW ?? 4;
    ctx.strokeStyle = opts.stroke ?? "rgba(255,255,255,0.92)";
    ctx.fillStyle = color;
    ctx.textBaseline = "alphabetic";
    ctx.strokeText(token, x, y);
    ctx.fillText(token, x, y);
    ctx.restore();
    return;
  }

  const fontMain = opts.fontMain || "16px Microsoft YaHei";
  const fontSub  = opts.fontSub  || "13px Microsoft YaHei";  // 下标不做得太小
  const subDx    = opts.subDx ?? 0.5;
  const subDy    = opts.subDy ?? 4.2;
  const stroke   = opts.stroke ?? "rgba(255,255,255,0.92)";
  const strokeW  = opts.strokeW ?? 4;

  ctx.save();
  ctx.textBaseline = "alphabetic";

  // 主字符
  ctx.font = fontMain;
  ctx.lineWidth = strokeW;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = color;
  ctx.strokeText(parsed.main, x, y);
  ctx.fillText(parsed.main, x, y);

  const w = ctx.measureText(parsed.main).width;

  // 下标
  ctx.font = fontSub;
  ctx.lineWidth = Math.max(3, strokeW - 1);
  ctx.strokeText(parsed.sub, x + w + subDx, y + subDy);
  ctx.fillText(parsed.sub, x + w + subDx, y + subDy);

  ctx.restore();
}

function drawArrowGlow(x1,y1,x2,y2,color,coreWidth=5){
  ctx.save();
  ctx.lineCap="round";
  ctx.lineJoin="round";

  const head = 22;
  const ang  = Math.atan2(y2 - y1, x2 - x1);
  const bx = x2 - head * Math.cos(ang);
  const by = y2 - head * Math.sin(ang);

  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = color;
  ctx.lineWidth = coreWidth + 3;
  ctx.beginPath();
  ctx.moveTo(x1,y1); ctx.lineTo(bx,by);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = coreWidth;
  ctx.beginPath();
  ctx.moveTo(x1,y1); ctx.lineTo(bx,by);
  ctx.stroke();

  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.moveTo(x2,y2);
  ctx.lineTo(x2-head*Math.cos(ang-Math.PI/7), y2-head*Math.sin(ang-Math.PI/7));
  ctx.lineTo(x2-head*Math.cos(ang+Math.PI/7), y2-head*Math.sin(ang+Math.PI/7));
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawMarchingOverlay(x1,y1,x2,y2,offset){
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.90)";
  ctx.lineWidth = 3;
  ctx.lineCap="round";
  ctx.setLineDash([10,10]);
  ctx.lineDashOffset = -offset;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const cut = 20;
  const ux = dx / len;
  const uy = dy / len;
  const ex = x2 - ux * cut;
  const ey = y2 - uy * cut;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawAcuteAngle(labelToken, rayAngle, radius, mode, color, jobs, opt = {}){
  const {px, py} = state;
  const base = (mode==="up") ? -Math.PI/2 : Math.PI/2;

  let d = rayAngle - base;
  while (d <= -Math.PI) d += 2*Math.PI;
  while (d >  Math.PI) d -= 2*Math.PI;
  const absd = Math.min(Math.abs(d), Math.PI - Math.abs(d));

  const side = (d >= 0) ? "right" : "left";
  const start = base;
  const end = (side==="left") ? base - absd : base + absd;

  // 角度弧线（可在波形之下，不影响辨识）
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(px, py, radius, start, end, side==="left");
  ctx.stroke();
  ctx.restore();

  // 角度文字：统一放到最后绘制，避免被波形压住
  const mid = (start+end)/2;
  const tx = px + (radius + (opt.rPad ?? 14)) * Math.cos(mid);
  const ty = py + (radius + (opt.rPad ?? 14)) * Math.sin(mid);

  const job = {
    token: labelToken,
    x: tx + (opt.dx ?? -8),
    y: ty + (opt.dy ?? 5),
    color
  };
  if (Array.isArray(jobs)) jobs.push(job);
  else {
    drawTextWithSub(ctx, job.token, job.x, job.y, job.color, {
      fontMain: "16px Microsoft YaHei",
      fontSub:  "13px Microsoft YaHei",
      subDy: 4.2,
      strokeW: 4
    });
  }
}


function vecFromNormal(thetaDeg, mode){
  const t = thetaDeg * Math.PI / 180;
  if(mode === "upLeft")  return { x: -Math.sin(t), y: -Math.cos(t) };
  if(mode === "upRight") return { x:  Math.sin(t), y: -Math.cos(t) };
  return { x: Math.sin(t), y: Math.cos(t) };
}

function fitLenToRect(px, py, vx, vy, rect, margin=22){
  const eps = 1e-9;
  let tMax = Infinity;

  if (vy > eps) tMax = Math.min(tMax, (rect.bottom - margin - py) / vy);
  if (vy < -eps) tMax = Math.min(tMax, (rect.top + margin - py) / vy);
  if (vx > eps) tMax = Math.min(tMax, (rect.right - margin - px) / vx);
  if (vx < -eps) tMax = Math.min(tMax, (rect.left + margin - px) / vx);

  if (!Number.isFinite(tMax) || tMax < 0) return 0;
  return tMax;
}

function pointToSegDist(px,py, x1,y1,x2,y2){
  const vx = x2-x1, vy=y2-y1;
  const wx = px-x1, wy=py-y1;
  const c1 = wx*vx + wy*vy;
  if (c1 <= 0) return Math.hypot(px-x1, py-y1);
  const c2 = vx*vx + vy*vy;
  if (c2 <= c1) return Math.hypot(px-x2, py-y2);
  const b = c1 / c2;
  const bx = x1 + b*vx, by = y1 + b*vy;
  return Math.hypot(px-bx, py-by);
}

function alphaFromPointer(mx,my){
  const {px, py} = state;
  const dx = mx - px;
  const dy = my - py;
  if (dy >= -1) return null;
  const theta = Math.atan2(Math.abs(dx), -dy) * 180/Math.PI;
  return clamp(theta, 0, 90);
}

function drawScene(all, p, dashOffset){
  const {W,H,interfaceY,px,py} = state;
  ctx.clearRect(0,0,W,H);

  
  // 角度文字统一最后绘制，确保位于最上层
  const angleTextJobs = [];
  const labelJobs = [];
ctx.fillStyle = COLOR.m1;
  ctx.fillRect(0,0,W,interfaceY);
  ctx.fillStyle = COLOR.m2;
  ctx.fillRect(0,interfaceY,W,H-interfaceY);

  ctx.strokeStyle = "#1b2b6a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, interfaceY);
  ctx.lineTo(W, interfaceY);
  ctx.stroke();

  drawDashedLine(px, py-320, px, py+320, COLOR.normal);

  const rectM1 = { left:0, right:W, top:0, bottom:interfaceY };
  const rectM2 = { left:0, right:W, top:interfaceY, bottom:H };

  const isIncS = (all.incType === "S");
  const incColor = isIncS ? COLOR.incS : COLOR.incL;
  const incLabel = isIncS ? "入射S" : "入射L";

  const incDir = vecFromNormal(all.alpha, "upLeft");
  const incLen = fitLenToRect(px, py, incDir.x, incDir.y, rectM1, 22);
  const incStart = { x: px + incLen*incDir.x, y: py + incLen*incDir.y };

  drawArrowGlow(incStart.x, incStart.y, px, py, incColor, 5);
  drawMarchingOverlay(incStart.x, incStart.y, px, py, dashOffset);
  {
    const a = Math.atan2(py - incStart.y, px - incStart.x);
    const back = Math.max(26, Math.min(44, Math.round(state.W/30)));
    const side = Math.max(12, Math.min(22, Math.round(state.W/70)));
    const lx = incStart.x + Math.cos(a)*back - Math.sin(a)*side;
    const ly = incStart.y + Math.sin(a)*back + Math.cos(a)*side;
    labelText(incLabel, lx, ly, incColor, labelJobs);
  }

  const showTip = (performance.now() - state.startMs < 4500) || state.hoverInc;
  if (showTip){
    ctx.save();
    ctx.font = "12px Microsoft YaHei";
    ctx.fillStyle = "rgba(20,30,50,0.72)";
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 4;
    const tx = incStart.x + 12;
    const ty = incStart.y + 52;
    ctx.strokeText("可拖动调整入射角", tx, ty);
    ctx.fillText("可拖动调整入射角", tx, ty);
    ctx.restore();
  }

  state.incSeg = { x1:incStart.x, y1:incStart.y, x2:px, y2:py };

  const angleMarks = [];

  function addRay(theta, mode, dirMode, color, label){
    if (theta == null || mode === "evanescent" || mode === "invalid" || mode === "na") return;
    const d = vecFromNormal(theta, dirMode);
    const len = fitLenToRect(px, py, d.x, d.y, rectM1, 22);
    const end = { x: px + len*d.x, y: py + len*d.y };

    drawArrowGlow(px, py, end.x, end.y, color, 5);
    drawMarchingOverlay(px, py, end.x, end.y, dashOffset);
    {
      const a = Math.atan2(end.y - py, end.x - px);
      const back = Math.max(28, Math.min(54, Math.round(state.W/26)));
      const side = Math.max(10, Math.min(20, Math.round(state.W/90)));
      const lx = end.x - Math.cos(a)*back - Math.sin(a)*side;
      const ly = end.y - Math.sin(a)*back + Math.cos(a)*side;
      labelText(label, lx, ly, color, labelJobs);
    }

    const ang = Math.atan2(end.y - py, end.x - px);
    // 角度 token：γL / γS
    const token = label.includes("L") ? "γL" : "γS";
    const r = (token==="γS") ? 78 : 58; // 反射纵/横波角错开显示
    drawAcuteAngle(token, ang, r, "up", color, angleTextJobs, token==="γS" ? {dx:-12, dy:7, rPad:16} : {dx:-8, dy:5, rPad:14});
  }

  addRay(all.gammaL, all.modeGammaL, "upRight", COLOR.rL, "反射L");
  addRay(all.gammaS, all.modeGammaS, "upRight", COLOR.rS, "反射S");

  function addRefr(theta, mode, color, label, radius){
    if (theta == null || mode === "evanescent" || mode === "invalid" || mode === "na") return;
    const d = vecFromNormal(theta, "downRight");
    const len = fitLenToRect(px, py, d.x, d.y, rectM2, 22);
    const end = { x: px + len*d.x, y: py + len*d.y };

    drawArrowGlow(px, py, end.x, end.y, color, 5);
    drawMarchingOverlay(px, py, end.x, end.y, dashOffset);
    {
      const a = Math.atan2(end.y - py, end.x - px);
      const back = Math.max(28, Math.min(54, Math.round(state.W/26)));
      const side = -Math.max(10, Math.min(20, Math.round(state.W/90)));
      const lx = end.x - Math.cos(a)*back - Math.sin(a)*side;
      const ly = end.y - Math.sin(a)*back + Math.cos(a)*side;
      labelText(label, lx, ly, color, labelJobs);
    }

    const ang = Math.atan2(end.y - py, end.x - px);
    const token = label.includes("L") ? "βL" : "βS";
    drawAcuteAngle(token, ang, radius, "down", color, angleTextJobs, token==="βS" ? {dx:-10, dy:6, rPad:16} : {dx:-8, dy:5, rPad:14});
  }
  addRefr(all.betaL, all.modeBetaL, COLOR.L, "折射L", 78);
  addRefr(all.betaS, all.modeBetaS, COLOR.S, "折射S", 104);

  // 入射角 α
  const angInc = Math.atan2(incStart.y - py, incStart.x - px);
  angleMarks.push({ label: (isIncS ? "αS" : "αL"), ang: angInc, radius: 52, mode:"up", color:"#111" });

  for (const mk of angleMarks){
    drawAcuteAngle(mk.label, mk.ang, mk.radius, mk.mode, mk.color, angleTextJobs);
  }

  // 角度文字最后绘制：保证最上层
  for (const job of angleTextJobs){
    drawTextWithSub(ctx, job.token, job.x, job.y, job.color, {
      fontMain: "16px Microsoft YaHei",
      fontSub:  "13px Microsoft YaHei",
      subDy: 4.2,
      strokeW: 4
    });
  }

  // 射线名称文字最后绘制，并随窗口自适应字号
  const labelFont = Math.max(13, Math.min(20, Math.round(state.W/55)));
  const labelStroke = Math.max(3, Math.round(labelFont*0.28));
  ctx.save();
  ctx.font = `900 ${labelFont}px Microsoft YaHei`;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = labelStroke;
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  for (const t of labelJobs){
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}

let DASH_OFFSET = 0;
function animate(){
  DASH_OFFSET = (DASH_OFFSET + 0.6) % 10000;
  if (LAST_ALL && LAST_P){
    drawScene(LAST_ALL, LAST_P, DASH_OFFSET);
  }
  requestAnimationFrame(animate);
}

/* ===== Pointer 拖拽 ===== */
let dragging = false;

function pointerToLocal(evt){
  const rect = canvas.getBoundingClientRect();
  const x = (evt.clientX - rect.left);
  const y = (evt.clientY - rect.top);
  return { x, y };
}

canvas.addEventListener("pointerdown", (e)=>{
  if (!state.incSeg) return;
  const m = pointerToLocal(e);
  const d = pointToSegDist(m.x, m.y, state.incSeg.x1, state.incSeg.y1, state.incSeg.x2, state.incSeg.y2);
  if (d <= 12){
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
  }
});

canvas.addEventListener("pointerup", (e)=>{
  dragging = false;
  try{ canvas.releasePointerCapture(e.pointerId);}catch(_){ }
  state.hoverInc = false;
  canvas.style.cursor = "default";
});

canvas.addEventListener("pointercancel", (e)=>{
  dragging = false;
  try{ canvas.releasePointerCapture(e.pointerId);}catch(_){ }
  canvas.style.cursor = "default";
});

canvas.addEventListener("pointermove", (e)=>{
  const m = pointerToLocal(e);

  if (!dragging && state.incSeg){
    const d = pointToSegDist(m.x, m.y, state.incSeg.x1, state.incSeg.y1, state.incSeg.x2, state.incSeg.y2);
    state.hoverInc = (d <= 12);
    canvas.style.cursor = state.hoverInc ? "grab" : "default";
  }

  if (!dragging) return;
  const a = alphaFromPointer(m.x, m.y);
  if (a == null) return;
  setAlpha(Math.round(a*10)/10);
});

/* ===== 初始化 ===== */
populateMaterialSelects();
bindMaterialButtons();
if (resizeCanvasToWrap()) {
  computeAndRender();
} else {
  requestAnimationFrame(()=>{ if (resizeCanvasToWrap()) computeAndRender(); });
}
setAlpha(30);
requestAnimationFrame(animate);