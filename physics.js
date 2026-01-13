// physics.js  —— 纯物理计算（不操作DOM、不绘图）
(function (global) {
  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;

  function clamp(x, a, b) {
    return Math.max(a, Math.min(b, x));
  }

  // 返回：{theta, mode, sinVal}
  function solveThetaFromSin(sinVal) {
    if (!Number.isFinite(sinVal)) return { theta: null, mode: "invalid", sinVal };
    if (Math.abs(sinVal) < 1) return { theta: Math.asin(clamp(sinVal, -1, 1)) * DEG, mode: "real", sinVal };
    if (Math.abs(sinVal) === 1) return { theta: 90, mode: "critical", sinVal };
    return { theta: null, mode: "evanescent", sinVal };
  }

  // 临界角：sinθc = C1/Cj（当 sinθj=1）
  function solveCritical(C1, Cj) {
    if (!(Number.isFinite(C1) && C1 > 0 && Number.isFinite(Cj) && Cj > 0)) return null;
    const r = C1 / Cj;
    if (r > 1) return null;           // 永远达不到临界（不会出现沿界面传播）
    return Math.asin(clamp(r, -1, 1)) * DEG;
  }

  /**
   * Snell（声速版）：sin∠1/C1 = sin∠2/C2 = sin∠3/C3
   * ∠1：入射角（与上半法线夹角，锐角）
   * ∠2：折射横波角（与下半法线夹角，锐角）
   * ∠3：折射纵波角（与下半法线夹角，锐角）
   */
  function computeRefraction({ theta1Deg, C1, C2, C3 }) {
    const t1 = clamp(Number(theta1Deg ?? 0), 0, 89.999);
    const c1 = Number(C1);
    const c2 = Number(C2);
    const c3 = Number(C3);

    const sin1 = Math.sin(t1 * RAD);

    const sin2 = (Number.isFinite(c1) && c1 > 0 && Number.isFinite(c2) && c2 > 0) ? (sin1 * c2 / c1) : NaN;
    const sin3 = (Number.isFinite(c1) && c1 > 0 && Number.isFinite(c3) && c3 > 0) ? (sin1 * c3 / c1) : NaN;

    const r2 = solveThetaFromSin(sin2);
    const r3 = solveThetaFromSin(sin3);

    const thetaC2 = solveCritical(c1, c2); // 对应折射横波分支（C2）
    const thetaC3 = solveCritical(c1, c3); // 对应折射纵波分支（C3）

    return {
      theta1: t1,

      // 折射角
      theta2: r2.theta,
      theta3: r3.theta,
      mode2: r2.mode,
      mode3: r3.mode,
      sin2: r2.sinVal,
      sin3: r3.sinVal,

      // 临界角（分别对应C2/C3分支）
      thetaC2,
      thetaC3
    };
  }

  global.UltrasonicPhysics = { computeRefraction };
})(window);
