/* National planning workspace, backed by the versioned national data catalog. */
(() => {
  const root=document.getElementById("nationalPlanning");
  const dialog=document.getElementById("npDialog");
  const {criteria,keys,check,parseCSV}=window.PlanningWeights;
  const core=window.ContractCore;
  const el=selector=>root.querySelector(selector);
  const fmt=value=>value==null?"Sin datos":new Intl.NumberFormat("es-ES",{maximumFractionDigits:4}).format(value);
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const btn=(action,label,attrs="")=>`<button type="button" data-np="${action}" ${attrs}>${label}</button>`;
  const blank=()=>Object.fromEntries(keys.map(key=>[key,""]));
  const defaultQuota=10000;
  const captureKey="historico_caza";
  const st={
    active:false,role:null,loading:false,db:null,currentCatalog:null,communities:[],geo:null,scenarios:[],
    scenario:"",quota:defaultQuota,note:"",sources:{},series:{},weights:{abundancias:60,tendencias:0,historico_caza:40},
    settings:0,batchVersion:0,nextRow:1,batch:[],batchIndex:null,pair:false,a:null,b:null,
    savedA:"",savedB:"",preview:null,previewName:"",tab:"batch",collapsed:true,community:"",busy:false,
    message:"",error:"",details:{weights:true,sources:false}
  };
  let geoRequest=null,loadVersion=0;
  const intervals=(id,db=st.db)=>(db?.intervals||[]).filter(v=>v.series_id===id)
    .sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end)||a.name.localeCompare(b.name));
  function captureYear(v) {
    const start=Number(v.start.slice(0,4)),end=Number(v.end.slice(0,4));
    return end===start||end===start+1&&v.end.slice(5)<v.start.slice(5)?start:null;
  }
  function annualCaptures(windows) {
    const years=new Map();
    for(const v of windows) {
      const year=captureYear(v);
      if(year!==null)years.set(year,years.has(year)?null:v);
    }
    return years;
  }
  function nextCaptureYear(years,year) {
    const current=years.get(year),next=years.get(year+1);
    return current&&next&&current.end<next.start;
  }
  function captureEndYears(years,start) {
    const ends=[];
    for(let year=start;nextCaptureYear(years,year);year++)ends.push(year+1);
    return ends;
  }
  function scenarioSelections(result) {
    return Object.fromEntries(keys.map(key=>{
      const source=result.sources[key];
      if(key===captureKey&&source?.mode==="annual_mean") {
        return [key,{series_id:source.series_id,start_year:source.years[0],end_year:source.years.at(-1)}];
      }
      return [key,source?.interval_id||""];
    }));
  }
  async function api(path,body=null) {
    const response=await fetch(path,body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{});
    const data=await response.json();
    if(!response.ok||data.ok===false)throw new Error(data.message||"No se pudo completar la operación.");
    return data;
  }
  const endpoint=part=>`/api/national-planning${part}?role=${encodeURIComponent(st.role)}`;
  function ensureGeo() {
    if(st.geo)return Promise.resolve();
    geoRequest??=api("/api/national-data/geometry").then(geo=>{st.geo=geo;publishMap();}).finally(()=>{geoRequest=null;});
    return geoRequest;
  }
  function chooseDefaults(db) {
    st.db=db;
    st.series={};
    st.sources={};
    for(const key of keys) {
      const choices=db.series.filter(s=>s.component===key);
      const choice=choices.find(s=>intervals(s.id,db).length)||choices[0];
      st.series[key]=choice?.id||"";
      st.sources[key]=intervals(choice?.id,db).at(-1)?.id||"";
    }
  }
  async function load() {
    const version=++loadVersion;
    st.loading=true;
    render();
    try {
      const [data,stored]=await Promise.all([api("/api/national-data"),api(endpoint("")),ensureGeo()]);
      if(version!==loadVersion)return;
      st.currentCatalog=data.catalog;
      st.communities=data.communities;
      st.scenarios=stored.scenarios;
      if(!st.db)chooseDefaults(data.catalog);
      if(!st.batch.length)addRows([{weights:blank()}]);
    } catch(error) {
      if(version===loadVersion)st.error=error.message;
    } finally {
      if(version===loadVersion){st.loading=false;render();}
    }
  }
  function sync(active,role) {
    const entering=active&&!st.active,changed=role!==st.role;
    st.active=active;
    root.hidden=!active;
    document.body.classList.toggle("np-active",active);
    if(!active)return;
    if(changed) {
      st.role=role;
      st.db=st.currentCatalog=null;
      st.scenario=st.savedA=st.savedB="";
      st.scenarios=[];
      st.preview=null;
      st.previewName="";
      st.quota=defaultQuota;
      st.note="";
      st.weights={abundancias:60,tendencias:0,historico_caza:40};
      st.batch=[];
      st.batchIndex=st.a=st.b=null;
      st.pair=false;
      st.settings++;
      st.batchVersion++;
      st.message=st.error="";
    }
    if(entering||changed)load();
    else publishMap();
  }
  function addRows(rows) {
    for(const {name,weights} of rows)st.batch.push({id:st.nextRow++,name:name||"",weights,result:null,error:""});
    st.batchVersion++;
  }
  function rowById(id) {return st.batch.find(row=>row.id===Number(id));}
  function rowName(row) {return row?.name.trim()||`Variante ${row?.id}`;}
  function scenarioById(id) {return st.scenarios.find(item=>item.id===id);}
  function currentMap() {
    if(st.tab==="batch"&&!st.collapsed) {
      const b=rowById(st.pair?st.b:st.batchIndex),a=st.pair?rowById(st.a):null;
      if(b?.result)return {b:b.result,bLabel:rowName(b),a:a?.result,aLabel:a?rowName(a):""};
    }
    if(st.tab==="compare"&&!st.collapsed) {
      const a=scenarioById(st.savedA),b=scenarioById(st.savedB);
      if(b)return {a:a?.result,aLabel:a?.name,b:b.result,bLabel:b.name};
    }
    return {b:st.preview,bLabel:st.previewName||"Vista previa del reparto"};
  }
  function publishMap() {
    if(!st.active)return;
    const {a,b,aLabel,bLabel}=currentMap();
    const rows=b?.rows||[];
    window.ContractLiveMap?.update({
      active:true,atlas:true,planning:true,geo:st.geo,component:"cupos",valueLabel:"Cupos",
      title:b?(a?`Comparación de cupos · A ${fmt(a.quota)} · B ${fmt(b.quota)}`:`${bLabel} · ${fmt(b.quota)} cupos`):"Reparto nacional",
      rows:a?.rows||rows,second:a?rows:[],range:core.domain([...(a?.rows||[]),...rows]),
      mode:a?"split":"values",labelA:aLabel,labelB:bLabel,selected:st.community,
      onSelect:selectCommunity
    });
  }
  function status() {
    const node=el("[data-np-status]");
    if(!node)return;
    node.textContent=st.error||st.message;
    node.classList.toggle("nc-error",Boolean(st.error));
  }
  function context() {
    const quota=Number(st.quota);
    if(!/^\d+$/.test(String(st.quota).trim())||!Number.isSafeInteger(quota)||quota<1||quota>1e15) {
      throw new Error("Introduce un cupo nacional entero mayor que cero.");
    }
    if(!st.db)throw new Error("El catálogo de datos aún se está cargando.");
    return {quota,revision:st.db.revision,sources:{...st.sources}};
  }
  function invalidate() {
    st.settings++;
    st.preview=null;
    st.batch.forEach(row=>{row.result=null;row.error="";});
    st.a=st.b=st.batchIndex=null;
    st.pair=false;
  }
  function choices(items,value,placeholder,label=item=>item.name) {
    return `<option value="">${placeholder}</option>`+items.map(item=>
      `<option value="${esc(item.id)}" ${String(item.id)===String(value)?"selected":""}>${esc(label(item))}</option>`).join("");
  }
  function captureMeanFields(years,starts,selection,series) {
    const {start_year:start,end_year:end}=selection;
    const ends=captureEndYears(years,start);
    const options=(items,value)=>items.map(year=>`<option value="${year}" ${year===value?"selected":""}>${year}</option>`).join("");
    const windows=Array.from({length:end-start+1},(_,index)=>years.get(start+index));
    const missing=st.communities.flatMap(c=>{
      const absent=windows.filter(v=>!core.present(v.rows.find(row=>row.ccaa_codigo===c.code)?.value));
      return absent.length?[`<li>${esc(c.name)} · ${absent.map(captureYear).join(", ")}</li>`]:[];
    });
    const demo=windows.some(v=>core.exampleInterval(v,series));
    return `<div class="np-capture-years">
      <label>Desde<select id="npCaptureStart">${options(starts,start)}</select></label>
      <label>Hasta<select id="npCaptureEnd">${options(ends,end)}</select></label>
    </div>
    <p class="nc-muted">Media de ${windows.length} años · ${st.communities.length-missing.length} de ${st.communities.length} comunidades con datos completos${demo?" · Datos de ejemplo":""}</p>
    ${missing.length?`<details class="np-capture-missing"><summary>Años sin datos por comunidad</summary>
      <ul>${missing.join("")}</ul><p>Si Capturas tiene peso, el reparto usa las comunidades con datos en todos los años elegidos.</p>
    </details>`:""}`;
  }
  function captureFields(windows,selection,series) {
    const years=annualCaptures(windows);
    const starts=[...years.keys()].filter(year=>nextCaptureYear(years,year));
    const mean=selection&&typeof selection==="object";
    const singleLabel=windows.some(v=>captureYear(v)===null)?"Año o intervalo":"Año";
    return `<label>Usar capturas<select id="npCaptureMode">
      <option value="single" ${mean?"":"selected"}>Un año</option>
      <option value="annual_mean" ${mean?"selected":""} ${starts.length?"":"disabled"}>Promedio de varios años</option>
    </select></label>
    ${mean?captureMeanFields(years,starts,selection,series):
      `<label>${singleLabel}<select data-np-interval="${captureKey}">${choices(windows,selection,"Seleccionar año",core.intervalLabel)}</select></label>
      ${starts.length?"":'<p class="nc-muted">El promedio requiere al menos dos años consecutivos con un intervalo por año.</p>'}`}`;
  }
  function sourceFields(key,label) {
    const available=st.db?.series.filter(s=>s.component===key)||[];
    const series=available.find(s=>s.id===st.series[key]);
    const windows=intervals(series?.id);
    const selection=st.sources[key];
    const window=windows.find(v=>v.id===selection);
    const n=window?.rows.filter(row=>core.present(row.value)).length;
    const demo=window&&core.exampleInterval(window,series);
    const annual=key===captureKey&&series?.interval_type!=="Promedio plurianual"&&windows.some(v=>captureYear(v)!==null);
    return `<div class="np-source"><strong>${label}</strong>
      <label>Serie<select data-np-series="${key}">${choices(available,series?.id,"Seleccionar serie")}</select></label>
      ${annual?captureFields(windows,selection,series):
        `<label>Intervalo<select data-np-interval="${key}" ${windows.length?"":"disabled"}>${choices(windows,window?.id,"Seleccionar intervalo",core.intervalLabel)}</select></label>`}
      ${series?`<p class="nc-muted">${esc(series.source)}</p>`:""}
      ${window?`<p class="nc-muted">${fmt(n)} de ${st.communities.length} comunidades${demo?" · Datos de ejemplo":""}</p>`:""}
    </div>`;
  }
  function sidebar() {
    return `<aside class="nc-side nc-atlas-side np-sidebar" aria-label="Configuración del reparto">
      <header class="np-species"><img src="/assets/atlas/tortolas-lilford-transparente.webp" width="1100" height="650" alt="">
        <div><h1>Reparto nacional</h1><p class="nc-atlas-latin">Tórtola europea</p></div>
      </header>
      <label class="np-quota">Cupo nacional<input id="npQuota" type="number" min="1" step="1" value="${esc(st.quota)}" placeholder="Introducir cupo" aria-describedby="npQuotaError"></label>
      <p id="npQuotaError" class="np-invalid nc-muted" hidden>Introduce un cupo entero mayor que cero.</p>
      <div class="np-scenario">
        <label>Escenario<select id="npScenario">${choices(st.scenarios,st.scenario,"Nuevo escenario")}</select></label>
        <div class="nc-actions">${btn("save","Guardar como escenario",'data-np-save-current')}</div>
      </div>
      <details class="nc-atlas-section np-config" data-np-details="weights" ${st.details.weights?"open":""}>
        <summary>Pesos</summary>
        <div class="np-weights">${keys.map(key=>`<label>${criteria[key]}<input aria-label="Peso de ${criteria[key]}" type="number" min="0" max="100" step="any" data-np-weight="${key}" value="${esc(st.weights[key])}"><span aria-hidden="true">%</span></label>`).join("")}</div>
        <div class="np-weight-bar" aria-hidden="true"><i></i><i></i><i></i></div>
        <p class="np-total"><span>Total</span><strong data-np-total aria-live="polite"></strong></p>
      </details>
      <details class="nc-atlas-section np-config" data-np-details="sources" ${st.details.sources?"open":""}>
        <summary>Ficha del escenario</summary>
        <label>Nota<input id="npNote" maxlength="500" value="${esc(st.note)}" placeholder="Qué quiero probar"></label>
        ${Object.entries(criteria).map(([key,label])=>sourceFields(key,label)).join("")}
        ${st.db?`<p class="nc-muted">Revisión de datos ${st.db.revision}</p>`:""}
        ${st.db&&st.currentCatalog?.revision!==st.db.revision?btn("current-data","Usar catálogo actual"):""}
      </details>
      ${btn("preview","Previsualizar reparto",'class="nc-primary np-preview"')}
      <p role="status" data-np-status class="np-status"></p>
      <div id="npInspector" class="nc-atlas-detail" aria-live="polite"></div>
    </aside>`;
  }
  function inspector() {
    const {a,b}=currentMap();
    const selected=st.communities.find(c=>c.code===st.community);
    const value=b?.rows.find(row=>row.ccaa_codigo===selected?.code)?.value;
    const before=a?.rows.find(row=>row.ccaa_codigo===selected?.code)?.value;
    const delta=before!=null&&value!=null?value-before:null;
    const label=delta==null?"Sin pareja de datos":`${delta>0?"+":""}${fmt(delta)} cupos`;
    const coverage=b?`<p class="nc-atlas-coverage"><strong>${b.covered} de ${b.total_communities}</strong> comunidades con reparto</p>`:"";
    const demo=a?.demonstration||b?.demonstration?`<p class="np-example">El reparto usa datos de ejemplo.</p>`:"";
    el("#npInspector").innerHTML=coverage+demo+`
      <label>Comunidad<select id="npCommunity">${choices(st.communities.map(c=>({id:c.code,name:c.name})),st.community,"Seleccionar en el mapa")}</select></label>
      ${selected&&b?`<div class="np-community"><h2>${esc(selected.name)}</h2>
        ${a?`<p>A · ${fmt(before)} · B · ${fmt(value)}</p><strong>${label}</strong>`:`<strong>${fmt(value)}${value==null?"":" cupos"}</strong>`}
      </div>`:""}`;
  }
  function selectCommunity(code) {
    if(!st.active)return;
    st.community=code;
    inspector();
    publishMap();
  }
  function batchRow(row) {
    return `<tr data-np-row="${row.id}">
      <td><input maxlength="100" placeholder="Variante ${row.id}" value="${esc(row.name)}" data-np-name aria-label="Nombre de variante ${row.id}"></td>
      ${keys.map(key=>`<td><input type="number" min="0" max="100" step="any" value="${esc(row.weights[key])}" data-np-cell="${key}" aria-label="${criteria[key]} de variante ${row.id} (%)"></td>`).join("")}
      <td data-np-row-status></td>
      <td><div class="nc-actions">${btn("view-row","Ver",`aria-label="Ver variante ${row.id}"`)}${btn("remove-row","Quitar",`aria-label="Quitar variante ${row.id}"`)}</div></td>
    </tr>`;
  }
  function batchPanel() {
    return `<div class="nc-actions np-batch-toolbar">
      ${btn("add-row","Añadir fila")}${btn("import","Importar CSV")}${btn("template","Plantilla CSV")}
      <input type="file" id="npCSV" accept=".csv,text/csv" hidden>
    </div>
    <div class="nc-actions np-batch-toolbar">
      ${btn("run-batch","Calcular combinaciones",'class="nc-primary"')}${btn("pair","Comparar dos variantes",'aria-pressed="false"')}
      ${btn("save-row","Guardar variante como escenario",'data-np-save-variant')}
      <span class="nc-muted" data-np-batch-count aria-live="polite"></span>
    </div>
    <div class="np-pairs" data-np-pickers hidden></div>
    <div class="nc-table-wrap np-batch-table"><table class="nc-table"><thead><tr>
      <th scope="col">Variante</th><th scope="col">Abundancia (%)</th><th scope="col">Tendencia (%)</th><th scope="col">Capturas (%)</th>
      <th scope="col">Total</th><th scope="col">Acciones</th>
    </tr></thead><tbody>${st.batch.map(batchRow).join("")}</tbody></table></div>`;
  }
  function resultTable() {
    const {a,b}=currentMap();
    if(!b)return "<p class='nc-muted'>Previsualiza el reparto para consultar los cupos.</p>";
    const rows=st.communities.map(c=>{
      const v=b.rows.find(row=>row.ccaa_codigo===c.code)?.value;
      const before=a?.rows.find(row=>row.ccaa_codigo===c.code)?.value;
      return `<tr><td>${esc(c.name)}</td>${a?`<td>${fmt(before)}</td>`:""}<td>${fmt(v)}</td>${a?`<td>${before!=null&&v!=null?fmt(v-before):"—"}</td>`:""}</tr>`;
    });
    return `<div class="nc-table-wrap"><table class="nc-table"><thead><tr><th scope="col">Comunidad</th>
      ${a?'<th scope="col">Cupo A</th><th scope="col">Cupo B</th><th scope="col">B − A</th>':'<th scope="col">Cupo</th>'}
      </tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
  }
  function captureReference(id) {
    const result=scenarioById(id)?.result;
    const source=result?.sources[captureKey];
    if(!source||!(result.weights[captureKey]>0))return "";
    const label=source.mode==="annual_mean"
      ?`Media de ${source.years.length} años · ${source.interval}`
      :core.intervalLabel(source);
    return `<small class="nc-muted">Capturas · ${esc(label)}</small>`;
  }
  function comparePanel() {
    return `<div class="np-pairs"><label>Escenario A<select id="npSavedA">${choices(st.scenarios.filter(s=>s.id!==st.savedB),st.savedA,"Seleccionar escenario")}</select>${captureReference(st.savedA)}</label>
      <label>Escenario B<select id="npSavedB">${choices(st.scenarios.filter(s=>s.id!==st.savedA),st.savedB,"Seleccionar escenario")}</select>${captureReference(st.savedB)}</label></div>${resultTable()}`;
  }
  function dock() {
    const tabs=[["table","Tabla"],["compare","Comparar"],["batch","Prueba de pesos"]];
    return `<section class="nc-dock np-dock">${window.ContractDock.grip("npDockBody")}<header class="nc-dock-header">
      <div class="nc-tabs" role="tablist">${tabs.map(([key,label])=>btn("tab",label,`data-tab="${key}" role="tab" aria-selected="${key===st.tab}" class="${key===st.tab?"active":""}"`)).join("")}</div>
      ${window.ContractDock.toggle("npDockBody",'data-np="collapse"')}
    </header><div id="npDockBody" class="nc-dock-body np-dock-body" ${st.collapsed?"hidden":""}>
      ${st.tab==="batch"?batchPanel():st.tab==="compare"?comparePanel():resultTable()}
    </div></section>`;
  }
  function quotaOK() {
    return /^\d+$/.test(String(st.quota).trim())&&Number(st.quota)>0&&Number(st.quota)<=1e15;
  }
  function refreshWeights() {
    const result=check(st.weights);
    const label=el("[data-np-total]");
    if(!label)return;
    const gap=result.total==null?null:100-result.total;
    label.textContent=gap==null?"—":Math.abs(gap)>1e-8?
      `${fmt(result.total)} % · ${gap>0?"faltan":"sobran"} ${fmt(Math.abs(gap))} pp`:
      result.error||"100 %";
    label.classList.toggle("np-invalid",Boolean(result.error));
    root.querySelectorAll(".np-weight-bar i").forEach((segment,i)=>{
      segment.style.width=`${Math.min(100,Math.max(0,Number(st.weights[keys[i]])||0))}%`;
    });
    const badQuota=st.quota!==""&&!quotaOK();
    el("#npQuota").setAttribute("aria-invalid",String(badQuota));
    el("#npQuotaError").hidden=!badQuota;
    const disabled=st.loading||st.busy||!quotaOK()||Boolean(result.error);
    el('[data-np="preview"]').disabled=disabled;
    el("[data-np-save-current]").disabled=disabled;
  }
  function refreshBatch() {
    if(st.tab!=="batch"||!el("[data-np-batch-count]"))return;
    const ready=st.batch.filter(row=>row.result);
    const b=rowById(st.pair?st.b:st.batchIndex);
    el("[data-np-batch-count]").textContent=`${ready.length} de ${st.batch.length} calculadas`;
    const save=el("[data-np-save-variant]");
    save.disabled=st.busy||!b?.result;
    save.textContent=b?.result?`Guardar ${rowName(b)} como escenario`:"Guardar variante como escenario";
    const pair=el('[data-np="pair"]');
    pair.disabled=ready.length<2;
    pair.setAttribute("aria-pressed",String(st.pair));
    el('[data-np="run-batch"]').disabled=st.busy||st.loading||!quotaOK()||!st.batch.length;
    const pick=el("[data-np-pickers]");
    pick.hidden=!st.pair;
    if(st.pair) {
      const options=ready.map(row=>({id:row.id,name:rowName(row)}));
      pick.innerHTML=`<label>Mapa A<select id="npBatchA">${choices(options.filter(row=>row.id!==st.b),st.a,"Elegir variante")}</select></label>
        <label>Mapa B<select id="npBatchB">${choices(options.filter(row=>row.id!==st.a),st.b,"Elegir variante")}</select></label>`;
    }
    root.querySelectorAll("[data-np-row]").forEach((tr,i)=>{
      const row=st.batch[i],result=check(row.weights);
      const label=tr.querySelector("[data-np-row-status]");
      label.textContent=row.error||(result.total==null?"—":`${fmt(result.total)} %`);
      label.classList.toggle("np-invalid",Boolean(row.error)||result.total!=null&&Boolean(result.error));
      tr.classList.toggle("np-selected",Boolean(row.result)&&(row.id===b?.id||st.pair&&row.id===st.a));
      tr.querySelector('[data-np="view-row"]').disabled=!row.result;
    });
  }
  function render() {
    if(!st.active)return;
    const side=el(".np-sidebar")?.scrollTop||0,body=el(".np-dock-body")?.scrollTop||0;
    root.querySelectorAll("[data-np-details]").forEach(node=>{st.details[node.dataset.npDetails]=node.open;});
    root.innerHTML=sidebar()+dock();
    el(".np-sidebar").scrollTop=side;
    el(".np-dock-body").scrollTop=body;
    window.ContractDock.sync(root,st.collapsed);
    refreshWeights();
    refreshBatch();
    status();
    inspector();
    publishMap();
  }
  async function preview() {
    const config=context(),weights=check(st.weights),version=st.settings,role=st.role;
    if(weights.error)throw new Error(weights.error);
    const data=await api(endpoint("/calculate"),{...config,variants:[weights.values]});
    if(version!==st.settings||role!==st.role)return;
    const answer=data.results[0];
    if(!answer.ok)throw new Error(answer.message);
    st.preview=answer.result;
    st.previewName="Vista previa del reparto";
    st.tab="table";
    st.collapsed=true;
  }
  async function runBatch() {
    const config=context(),version=st.settings,batchVersion=st.batchVersion,role=st.role;
    const rows=st.batch.map(row=>{
      const weights=check(row.weights);
      if(weights.error)throw new Error(`${rowName(row)}. ${weights.error}`);
      return {row,weights:weights.values};
    });
    const results=[];
    for(let start=0;start<rows.length;start+=100) {
      const variants=rows.slice(start,start+100).map(row=>row.weights);
      const response=await api(endpoint("/calculate"),{...config,variants});
      if(version!==st.settings||batchVersion!==st.batchVersion||role!==st.role)return;
      results.push(...response.results);
    }
    results.forEach((answer,i)=>{
      const {row}=rows[i];
      row.result=answer.result||null;
      row.error=answer.ok?"":answer.message;
    });
    const ready=st.batch.filter(row=>row.result);
    st.batchIndex=ready[0]?.id||null;
    st.a=ready[0]?.id||null;
    st.b=ready[1]?.id||null;
    st.pair=st.pair&&ready.length>1;
    st.message=`${ready.length} de ${rows.length} combinaciones calculadas.`;
  }
  async function openScenario(id) {
    if(!id) {
      st.scenario="";
      st.quota=defaultQuota;
      st.note="";
      chooseDefaults(st.currentCatalog);
      invalidate();
      return;
    }
    const saved=scenarioById(id),result=saved.result,role=st.role;
    const db=st.currentCatalog.revision===result.revision?st.currentCatalog:
      (await api(`/api/national-data/snapshot?revision=${result.revision}`)).catalog;
    if(role!==st.role)return;
    invalidate();
    st.scenario=id;
    st.db=db;
    st.quota=result.quota;
    st.note=saved.note;
    st.weights={...result.weights};
    st.series=Object.fromEntries(keys.map(key=>[key,result.sources[key]?.series_id||""]));
    st.sources=scenarioSelections(result);
    st.preview=result;
    st.previewName=saved.name;
    st.tab="table";
  }
  function saveDialog(result=null,suggested="") {
    const inputs=result?{quota:result.quota,revision:result.revision,weights:result.weights,
      sources:scenarioSelections(result)}:
      {...context(),weights:check(st.weights).values};
    if(!inputs.weights)throw new Error(check(st.weights).error);
    const role=st.role;
    dialog.innerHTML=`<form><header><h2>Guardar escenario</h2></header>
      <label>Nombre<input name="name" required maxlength="100" value="${esc(suggested)}"></label>
      <label>Nota<textarea name="note" maxlength="500">${esc(st.note)}</textarea></label>
      <p class="nc-error" data-save-error role="alert" hidden></p>
      <footer><button type="button" data-cancel>Cancelar</button><button type="submit" class="nc-primary">Guardar</button></footer></form>`;
    dialog.querySelector("[data-cancel]").onclick=()=>dialog.close();
    dialog.querySelector("form").onsubmit=async event=>{
      event.preventDefault();
      const button=event.submitter;
      button.disabled=true;
      const data=Object.fromEntries(new FormData(event.target));
      try {
        const saved=await api(endpoint("/scenarios"),{...inputs,...data});
        if(role!==st.role)return;
        st.scenarios.unshift(saved.scenario);
        dialog.close();
        if(!result) {
          st.scenario=saved.scenario.id;
          st.note=saved.scenario.note;
          st.preview=saved.scenario.result;
          st.previewName=saved.scenario.name;
        }
        st.message=`Escenario guardado: ${saved.scenario.name}.`;
        render();
      } catch(error) {
        const box=dialog.querySelector("[data-save-error]");
        box.hidden=false;
        box.textContent=error.message;
      } finally {button.disabled=false;}
    };
    dialog.showModal();
  }
  function downloadTemplate() {
    const blob=new Blob(["\uFEFFnombre;abundancia;tendencia;capturas\r\nBase;60;0;40\r\nMás tendencia;48;20;32\r\n"],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;
    link.download="plantilla-pesos.csv";
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),0);
  }
  async function work(action) {
    if(st.busy)return;
    st.busy=true;
    st.error=st.message="";
    refreshWeights();
    refreshBatch();
    status();
    try {await action();}
    catch(error) {st.error=error.message;}
    finally {st.busy=false;render();}
  }
  root.addEventListener("input",event=>{
    const node=event.target,row=rowById(node.closest("[data-np-row]")?.dataset.npRow);
    if(node.id==="npQuota") {
      st.quota=node.value;
      invalidate();
      refreshWeights();refreshBatch();inspector();publishMap();
    } else if(node.id==="npNote")st.note=node.value;
    else if(node.dataset.npWeight) {
      st.weights[node.dataset.npWeight]=node.value;
      st.settings++;
      st.preview=null;
      refreshWeights();inspector();publishMap();
    } else if(row) {
      if(node.hasAttribute("data-np-name"))row.name=node.value;
      else if(node.dataset.npCell) {
        row.weights[node.dataset.npCell]=node.value;
        row.result=null;
        row.error="";
        st.batchVersion++;
        if(row.id===st.a||row.id===st.b)st.pair=false;
      }
      refreshBatch();inspector();publishMap();
    }
  });
  root.addEventListener("change",event=>{
    const node=event.target;
    if(node.id==="npScenario")work(()=>openScenario(node.value));
    else if(node.id==="npCommunity")selectCommunity(node.value);
    else if(["npCaptureMode","npCaptureStart","npCaptureEnd"].includes(node.id)) {
      const series_id=st.series[captureKey],windows=intervals(series_id),years=annualCaptures(windows);
      if(node.id==="npCaptureMode"&&node.value==="single") {
        const current=st.sources[captureKey];
        st.sources[captureKey]=years.get(current.end_year).id;
      } else {
        const current=st.sources[captureKey];
        const start_year=node.id==="npCaptureStart"?Number(node.value):
          current?.start_year??[...years.keys()].findLast(year=>nextCaptureYear(years,year));
        const ends=captureEndYears(years,start_year);
        const end=node.id==="npCaptureEnd"?Number(node.value):current?.end_year;
        st.sources[captureKey]={series_id,start_year,end_year:ends.includes(end)?end:ends[0]};
      }
      invalidate();
      st.error=st.message="";
      render();
      el("#"+node.id)?.focus({preventScroll:true});
    } else if(node.dataset.npSeries||node.dataset.npInterval) {
      const key=node.dataset.npSeries||node.dataset.npInterval;
      if(node.dataset.npSeries) {
        st.series[key]=node.value;
        st.sources[key]=intervals(node.value).at(-1)?.id||"";
      } else st.sources[key]=node.value;
      invalidate();
      render();
    } else if(node.id==="npSavedA"||node.id==="npSavedB") {
      st[node.id==="npSavedA"?"savedA":"savedB"]=node.value;
      render();
    } else if(node.id==="npBatchA"||node.id==="npBatchB") {
      st[node.id==="npBatchA"?"a":"b"]=Number(node.value)||null;
      refreshBatch();inspector();publishMap();
    } else if(node.id==="npCSV"&&node.files[0]) {
      const file=node.files[0];
      work(async()=>{
        const rows=parseCSV(await file.text());
        if(st.batch.length===1&&!st.batch[0].name&&Object.values(st.batch[0].weights).every(value=>value===""))st.batch=[];
        addRows(rows);
        st.message=`${rows.length} combinaciones importadas.`;
      });
    }
  });
  root.addEventListener("click",event=>{
    const node=event.target.closest("[data-np]");
    if(!node)return;
    const action=node.dataset.np,row=rowById(node.closest("[data-np-row]")?.dataset.npRow);
    if(action==="preview"){work(preview);return;}
    if(action==="run-batch"){work(runBatch);return;}
    if(action==="template"){downloadTemplate();return;}
    if(action==="import"){el("#npCSV").click();return;}
    st.error=st.message="";
    try {
      if(action==="save"){saveDialog();return;}
      if(action==="save-row") {
        const selected=rowById(st.pair?st.b:st.batchIndex);
        if(selected?.result)saveDialog(selected.result,rowName(selected));
        return;
      }
      if(action==="tab") {
        st.tab=node.dataset.tab;
        st.collapsed=false;
        if(st.tab==="compare") {
          st.savedB=st.savedB||st.scenario||st.scenarios[0]?.id||"";
          st.savedA=st.savedA||st.scenarios.find(s=>s.id!==st.savedB)?.id||"";
        }
      }
      if(action==="collapse") {
        st.collapsed=!st.collapsed;
        render();
        el(".nc-dock-toggle").focus({preventScroll:true});
        return;
      }
      if(action==="add-row")addRows([{weights:blank()}]);
      if(action==="current-data"){st.scenario="";chooseDefaults(st.currentCatalog);invalidate();}
      if(action==="view-row"&&row?.result){st.batchIndex=row.id;st.pair=false;}
      if(action==="remove-row"&&row) {
        st.batch=st.batch.filter(item=>item!==row);
        st.batchVersion++;
        if(row.id===st.a||row.id===st.b)st.pair=false;
      }
      if(action==="pair") {
        const rows=st.batch.filter(item=>item.result);
        if(rows.length>1) {
          st.pair=!st.pair;
          if(!rows.some(item=>item.id===st.a))st.a=rows[0].id;
          if(!rows.some(item=>item.id===st.b)||st.a===st.b)st.b=rows.find(item=>item.id!==st.a).id;
        }
      }
      render();
      if(action==="add-row")el(`[data-np-row="${st.batch.at(-1).id}"] [data-np-cell]`)?.focus();
    } catch(error) {st.error=error.message;status();}
  });
  window.NationalPlanning={sync};
})();
