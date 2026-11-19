const assert = require("node:assert/strict");
const {check,parseCSV} = require("../frontend/planning-weights.js");

assert.equal(check({abundancias:60,tendencias:0,historico_caza:40}).total,100);
assert.match(check({abundancias:59,tendencias:0,historico_caza:40}).error,/sumar 100/);
assert.match(check({abundancias:0,tendencias:100,historico_caza:0}).error,/Abundancia o Capturas/);
assert.deepEqual(parseCSV('\uFEFFnombre;abundancia;tendencia;capturas\r\n"Alternativa; verano";40,5;19,5;40\r\n'),[
  {name:"Alternativa; verano",weights:{abundancias:40.5,tendencias:19.5,historico_caza:40}}
]);
assert.equal(parseCSV('capturas,tendencia,abundancia\n'+Array(130).fill('35,15,50').join('\n')).length,130);
assert.throws(()=>parseCSV('abundancia,tendencia,capturas\n60,20,30'),/Línea 2.*sumar 100/);
assert.throws(()=>parseCSV('abundancia,tendencia,capturas\n"60,20,20'),/sin cerrar/);
console.log("Planning weights and CSV checks passed.");
