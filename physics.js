// physics.js  —— 纯物理计算（不操作DOM、不绘图）
(function (global) {
  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;

  function clamp(x, a, b) {
    return Math.max(a, Math.min(b, x));
  }

  // 返回：{theta, mode, sinVal}
  // mode: real | critical | evanescent | na | invalid
  function solveThetaFromSin(sinVal) {
    if (sinVal == null) return { theta: null, mode: "na", sinVal };
    if (!Number.isFinite(sinVal)) return { theta: null, mode: "invalid", sinVal };
    const a = Math.abs(sinVal);
    if (a < 1) return { theta: Math.asin(clamp(sinVal, -1, 1)) * DEG, mode: "real", sinVal };
    if (a === 1) return { theta: 90, mode: "critical", sinVal };
    return { theta: null, mode: "evanescent", sinVal };
  }

  // 临界角：sin(alpha_c) = Cinc / Ctarget （当 target 分支折射/反射角=90°）
  function solveCritical(Cinc, Ctarget) {
    if (!(Number.isFinite(Cinc) && Cinc > 0 && Number.isFinite(Ctarget) && Ctarget > 0)) return null;
    const r = Cinc / Ctarget;
    if (r > 1) return null;
    return Math.asin(clamp(r, -1, 1)) * DEG;
  }

  function snellSin(thetaIncDeg, Cinc, Cother) {
    if (!(Number.isFinite(thetaIncDeg) && Number.isFinite(Cinc) && Cinc > 0 && Number.isFinite(Cother) && Cother > 0)) return null;
    const sinA = Math.sin(clamp(thetaIncDeg, 0, 89.999) * RAD);
    return sinA * Cother / Cinc;
  }

  /**
   * 按用户给定表格口径：
   * - 入射角：alphaL / alphaS
   * - 反射角：gammaL / gammaS（在介质1）
   * - 折射角：betaL / betaS（在介质2）
   * - 临界角：alpha1/alpha2（纵波入射）；alpha1/alpha2/alpha3（横波入射，alpha3 对应 gammaL=90°）
   */
  function computeAll({ incType, alphaDeg, cL1, cS1, cL2, cS2 }) {
    const a = clamp(Number(alphaDeg ?? 0), 0, 89.999);
    const isIncL = String(incType || "L").toUpperCase().includes("L");

    // 介质声速（允许 null 表示不存在）
    const CL1 = Number.isFinite(cL1) ? Number(cL1) : null;
    const CS1 = Number.isFinite(cS1) ? Number(cS1) : null;
    const CL2 = Number.isFinite(cL2) ? Number(cL2) : null;
    const CS2 = Number.isFinite(cS2) ? Number(cS2) : null;

    const Cinc = isIncL ? CL1 : CS1;

    // ---- 反射（介质1） ----
    // 同类反射：镜面反射（角度等于入射）
    const gammaSame = (Cinc && Number.isFinite(Cinc) && Cinc > 0) ? { theta: a, mode: "real", sinVal: Math.sin(a * RAD) } : { theta: null, mode: "invalid", sinVal: NaN };

    // 异类反射：用 Snell 求角度
    const CrefConv = isIncL ? CS1 : CL1;
    const sinGammaConv = snellSin(a, Cinc, CrefConv);
    const gammaConv = solveThetaFromSin(sinGammaConv);

    const gammaL = isIncL ? gammaSame : gammaConv; // 入射S时，gammaL是转换反射
    const gammaS = isIncL ? gammaConv : gammaSame; // 入射L时，gammaS是转换反射

    // ---- 折射（介质2） ----
    const sinBetaL = snellSin(a, Cinc, CL2);
    const sinBetaS = snellSin(a, Cinc, CS2);
    const betaL = solveThetaFromSin(sinBetaL);
    const betaS = solveThetaFromSin(sinBetaS);

    // ---- 临界角（按表定义：让对应分支角=90°，反求 alpha） ----
    let alpha1 = null;
    let alpha2 = null;
    let alpha3 = null;

    if (isIncL) {
      // 纵波入射：alpha1 对应 betaL=90°（需 cL2>cL1）；alpha2 对应 betaS=90°（需 cS2>cL1）
      alpha1 = solveCritical(CL1, CL2);
      alpha2 = solveCritical(CL1, CS2);
      alpha3 = null;
    } else {
      // 横波入射：alpha1 对应 betaL=90°（需 cL2>cS1）；alpha2 对应 betaS=90°（需 cS2>cS1）；alpha3 对应 gammaL=90°（需 cL1>cS1）
      alpha1 = solveCritical(CS1, CL2);
      alpha2 = solveCritical(CS1, CS2);
      alpha3 = solveCritical(CS1, CL1);
    }

    // 辅助：给出当前 alpha 与各临界角的关系
    function rel(alphaC) {
      if (alphaC == null || !Number.isFinite(alphaC)) return "na";
      const d = a - alphaC;
      if (Math.abs(d) < 1e-6) return "at";
      return d < 0 ? "below" : "above";
    }

    return {
      alpha: a,
      incType: isIncL ? "L" : "S",

      // angles (deg)
      gammaL: gammaL.theta,
      gammaS: gammaS.theta,
      betaL: betaL.theta,
      betaS: betaS.theta,

      // modes
      modeGammaL: gammaL.mode,
      modeGammaS: gammaS.mode,
      modeBetaL: betaL.mode,
      modeBetaS: betaS.mode,

      // critical angles
      alpha1,
      alpha2,
      alpha3,
      rel1: rel(alpha1),
      rel2: rel(alpha2),
      rel3: rel(alpha3),

      // raw sin values (debug/teaching)
      sinGammaL: isIncL ? gammaL.sinVal : (sinGammaConv ?? gammaL.sinVal),
      sinGammaS: isIncL ? (sinGammaConv ?? gammaS.sinVal) : gammaS.sinVal,
      sinBetaL,
      sinBetaS,
    };
  }

  global.UltrasonicPhysics = { computeAll };
})(window);
