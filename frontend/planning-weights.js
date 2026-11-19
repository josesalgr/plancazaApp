/* Weight validation shared by the editor and CSV import. */
(function (root) {
  const criteria = {
    abundancias: "Abundancia",
    tendencias: "Tendencia",
    historico_caza: "Capturas"
  };
  const keys = Object.keys(criteria);
  function check(weights) {
    const values = Object.fromEntries(keys.map(key => {
      const input = String(weights[key] ?? "").trim().replace(/\s*%$/, "").replace(",", ".");
      return [key, /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(input) ? Number(input) : NaN];
    }));
    const numbers = Object.values(values);
    if (!numbers.every(n => Number.isFinite(n) && n >= 0 && n <= 100)) {
      return {total: null, error: "Introduce los tres pesos entre 0 y 100."};
    }
    const total = numbers.reduce((sum, n) => sum + n, 0);
    if (Math.abs(total - 100) > 1e-8) return {total, error: "Los pesos deben sumar 100 %."};
    if (values.abundancias + values.historico_caza <= 0) {
      return {total, error: "Da algún peso a Abundancia o Capturas."};
    }
    return {total, values};
  }

  function records(text, delimiter) {
    const rows = [];
    let cells = [], field = "", quoted = false, closed = false, line = 1, startLine = 1;
    function finishField() {
      cells.push(field.trim());
      field = "";
      closed = false;
    }
    function finishRow() {
      finishField();
      if (cells.some(cell => cell !== "")) rows.push({line: startLine, cells});
      cells = [];
    }
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') {
          field += '"';
          i++;
        } else if (char === '"') {
          quoted = false;
          closed = true;
        } else {
          field += char;
          if (char === "\n") line++;
        }
      } else if (char === delimiter) {
        finishField();
      } else if (char === "\n") {
        finishRow();
        startLine = ++line;
      } else if (char === '"' && !closed && !field.trim()) {
        quoted = true;
        field = "";
      } else if (char === '"' || (closed && char.trim())) {
        throw new Error(`Línea ${line}. Revisa las comillas del CSV.`);
      } else {
        field += char;
      }
    }
    if (quoted) throw new Error(`Línea ${startLine}. Hay un campo sin cerrar.`);
    finishRow();
    return rows;
  }

  function parseCSV(source) {
    const text = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    const header = text.split("\n").find(line => line.trim());
    if (!header) throw new Error("El archivo CSV está vacío.");
    const rows = records(text, header.includes(";") ? ";" : ",");
    const aliases = new Map([
      ["abundancia", "abundancias"], ["abundancias", "abundancias"],
      ["tendencia", "tendencias"], ["tendencias", "tendencias"],
      ["capturas", "historico_caza"], ["historico_caza", "historico_caza"], ["nombre","nombre"]
    ]);
    const columns = (rows.shift()?.cells || []).map(field => aliases.get(field.toLowerCase()));
    if (columns.includes(undefined) || new Set(columns).size !== columns.length || !keys.every(key => columns.includes(key))) {
      throw new Error("Usa las columnas abundancia, tendencia y capturas. Puedes añadir nombre.");
    }
    if (!rows.length) throw new Error("El CSV no contiene combinaciones de pesos.");
    return rows.map(({line,cells}) => {
      if (cells.length !== columns.length) throw new Error(`Línea ${line}. El número de columnas no coincide con el encabezado.`);
      const row = Object.fromEntries(columns.map((key, i) => [key, cells[i]]));
      const result = check(row);
      if (result.error) throw new Error(`Línea ${line}. ${result.error}`);
      const name = (row.nombre || "").replace(/\s+/g, " ");
      if (name.length > 100) throw new Error(`Línea ${line}. El nombre admite hasta 100 caracteres.`);
      return {name, weights: result.values};
    });
  }

  const api = {criteria, keys, check, parseCSV};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PlanningWeights = api;
})(typeof window === "undefined" ? globalThis : window);
