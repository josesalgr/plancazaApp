/* Pure descriptive helpers: missing values never become zero. */
(function (root) {
  const legacyLabels = { en_alza: "En alza", decrecimiento: "Decrecimiento", constante: "Constante" };
  const sixLabels = {
    aumento_fuerte: "Aumento fuerte", aumento_moderado: "Aumento moderado", estable: "Estable",
    incierta: "Incierta", descenso_moderado: "Descenso moderado", descenso_pronunciado: "Descenso pronunciado"
  };
  const labels = { ...legacyLabels, ...sixLabels };
  const trendLabels = scheme => scheme === "seis_categorias" ? sixLabels : legacyLabels;
  const trendIcons = {
    en_alza:"↑", decrecimiento:"↓", constante:"→", aumento_fuerte:"↑↑", aumento_moderado:"↑",
    estable:"→", incierta:"?", descenso_moderado:"↓", descenso_pronunciado:"↓↓"
  };
  const present = v => v !== null && v !== undefined && v !== "";
  function intervalLabel({start, end}) {
    const [startYear, startMonth, startDay] = start.split("-");
    const [endYear, endMonth, endDay] = end.split("-");
    if (startMonth === "01" && startDay === "01" && endMonth === "12" && endDay === "31") {
      return startYear === endYear ? startYear : `${startYear}–${endYear}`;
    }
    const from = `${startDay}/${startMonth}/${startYear}`;
    return start === end ? from : `${from} – ${endDay}/${endMonth}/${endYear}`;
  }
  const exampleInterval = (interval, series) =>
    /fictici|demostraci/i.test([interval.name, series?.name, series?.source].join(" "));
  function quantile(sorted, p) {
    if (!sorted.length) return null;
    const i = (sorted.length - 1) * p, lo = Math.floor(i);
    return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
  }
  function describe(rows, component, total = 17, trendScheme) {
    const vals = rows.map(r => r.value).filter(present);
    const result = { n: vals.length, missing: total - vals.length, coverage: total ? vals.length / total * 100 : 0 };
    if (component === "tendencias") {
      result.counts = Object.fromEntries(Object.keys(trendLabels(trendScheme)).map(k => [k, vals.filter(v => v === k).length]));
    } else {
      const a = vals.map(Number).sort((a,b) => a-b), n = a.length;
      const mean = n ? a.reduce((s,v) => s+v,0)/n : null;
      Object.assign(result, { min: n ? a[0] : null, max: n ? a[n-1] : null, mean, median: quantile(a,.5), q1: quantile(a,.25), q3: quantile(a,.75), sd: n > 1 ? Math.sqrt(a.reduce((s,v) => s+(v-mean)**2,0)/(n-1)) : null, sum: n ? a.reduce((s,v) => s+v,0) : null });
    }
    return result;
  }
  function changes(before, incoming, clear = []) {
    const map = new Map(before.map(r => [r.ccaa_codigo,r]));
    return incoming.map(r => {
      const old = map.get(r.ccaa_codigo) || {value:null,observations:""};
      const next = clear.includes(r.ccaa_codigo) ? null : present(r.value) ? r.value : old.value;
      const changed = String(old.value ?? "") !== String(next ?? "") || (old.observations || "") !== (r.observations || "");
      return {...r, old:old.value, value:next, changed, status:!changed ? "Sin cambios" : !present(next) && present(old.value) ? "Retirada explícita" : !present(old.value) && present(next) ? "Nuevo dato" : "Corrección"};
    });
  }
  function compare(before, after, communities, component) {
    return communities.map(c => {
      const a = before.find(r=>r.ccaa_codigo===c.code)?.value ?? null;
      const b = after.find(r=>r.ccaa_codigo===c.code)?.value ?? null;
      const paired = present(a) && present(b);
      return {ccaa_codigo:c.code,name:c.name,a,b,paired,changed:paired ? a!==b : null,
        delta:paired && component!=="tendencias" ? Number((b-a).toPrecision(12)) : null};
    });
  }
  function domain(rows) {
    const a=rows.map(r=>r.value).filter(present).map(Number).filter(Number.isFinite);
    return a.length ? [Math.min(...a),Math.max(...a)] : null;
  }
  const api = {labels,trendLabels,trendIcons,present,intervalLabel,exampleInterval,quantile,describe,changes,compare,domain};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ContractCore = api;
})(typeof window === "undefined" ? globalThis : window);
