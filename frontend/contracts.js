/* National data workspace. All writes are validated again on the server. */
(() => {
  const core = window.ContractCore;
  const components = {
    abundancias:{name:"Abundancias",map:"Abundancia",field:"indice_abundancia",value:"Índice de abundancia"},
    tendencias:{name:"Tendencias",map:"Tendencia",field:"tendencia",value:"Tendencia"},
    historico_caza:{name:"Histórico de caza",map:"Capturas",field:"capturas",value:"Capturas"},
  };
  const st = {db:{revision:0,series:[],intervals:[]},communities:[],component:"abundancias",series:null,interval:null,captureGap:null,tab:"data",edit:false,dirty:false,section:"input",mapCode:null,compareA:null,compareB:null,geo:null,geoError:"",refreshing:false,loading:true,message:"",error:"",history:[],community:"all",tableAll:false,dockCollapsed:true,atlasManaging:false,compareMode:"split"};
  const atlasSections={maps:true,series:true,chart:true};
  const el = document.getElementById("nationalData");
  const dialog = document.getElementById("ncDialog");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmt = v => core.present(v) ? typeof v === "number" ? new Intl.NumberFormat("es-ES",{maximumFractionDigits:3}).format(v) : core.labels[v] || v : "Sin datos";
  const getSeries = () => st.db.series.find(x => x.id===st.series);
  const intervals = (seriesId=st.series) => st.db.intervals.filter(x=>x.series_id===seriesId).sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));
  const current = () => st.db.intervals.find(x=>x.id===st.interval);
  const period = (v, series=getSeries()) => core.intervalLabel(v)+(core.exampleInterval(v,series)?" · Ejemplo ficticio":"");
  const captures = () => st.component==="historico_caza";
  const captureAverage = () => captures() && getSeries()?.interval_type==="Promedio plurianual";
  const annualCaptures = () => captures() && !captureAverage();
  function valueLabel() {
    if(captureAverage())return "Promedio anual de capturas";
    const fallback=components[st.component].value;
    return st.component==="abundancias"?getSeries()?.unit||fallback:fallback;
  }
  const yearOf = v => Number(v.start.slice(0,4));
  const captureYear = () => current()?yearOf(current()):st.captureGap;
  const records = (v=current()) => st.communities.map(c=>({ccaa_codigo:c.code,value:null,observations:"",...(v?.rows||[]).find(r=>r.ccaa_codigo===c.code),name:c.name}));
  const rowTable = (heads, rows) => `<div class="nc-table-wrap"><table class="nc-table"><thead><tr>${heads.map(h=>`<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
  const button = (action,label,primary=false,extra="") => `<button type="button" data-nc="${action}" ${extra} class="${primary?"nc-primary":""}">${label}</button>`;
  function download(path, extra={}) {
    const p = new URLSearchParams({component:st.component,...(st.series?{series:st.series}:{}),...(st.interval?{interval:st.interval}:{}),...extra});
    const a=document.createElement("a");a.href=`/api/national-data/${path}?${p}`;a.download="";a.click();
  }
  async function api(path="",body=null) {
    const response=await fetch(`/api/national-data${path}`,body ? {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{});
    if(!response.ok) {let m;try{m=(await response.json()).message;}catch{} throw new Error(m||`No se pudo completar la operación (${response.status}).`);}
    return response.json();
  }
  async function load() {
    const r=await api(); st.db=r.catalog;st.communities=r.communities;st.loading=false;
    reconcileSelection();
  }
  function reconcileSelection() {
    if(!getSeries()) {
      st.series=st.db.series.find(s=>s.component===st.component)?.id||null;
      st.tab="data";
      st.compareA=st.compareB=null;
      st.captureGap=null;
    }
    if(annualCaptures()&&st.captureGap!==null) {
      st.interval=intervals().filter(v=>yearOf(v)===st.captureGap).at(-1)?.id||null;
      if(st.interval)st.captureGap=null;
      return;
    }
    if(!current() || current().series_id!==st.series) st.interval=intervals().at(-1)?.id||null;
  }
  function guard() {return !st.dirty || confirm("Hay cambios sin guardar. ¿Quieres descartarlos?");}
  async function refresh() {
    if(st.loading || st.refreshing || st.section!=="input")return;
    st.refreshing=true;
    const revision=st.db.revision;
    try {
      const r=await api();
      if(r.catalog.revision<=st.db.revision)return;
      if(st.edit || st.dirty || dialog.open || revision!==st.db.revision) {
        const msg=el.querySelector("#ncMessage");
        if(msg)msg.innerHTML='<p class="nc-note" role="status">Hay una nueva revisión disponible. Tus cambios se conservan. Termina o cancela la edición para recibirla; no se sobrescribirá tu trabajo.</p>';
        return;
      }
      st.db=r.catalog;st.communities=r.communities;
      reconcileSelection();
      if(st.tab==="history")st.history=(await api("/history")).history;
      st.message="Se han recibido los últimos datos de la serie.";render();
    } catch { /* Background failures never replace unsaved work or obstruct the view. */ }
    finally {st.refreshing=false;}
  }
  let geometryRequest=null;
  async function ensureGeometry() {
    if(st.geo)return;
    if(!geometryRequest)geometryRequest=api("/geometry").then(g=>{st.geo=g;st.geoError="";}).catch(e=>{st.geoError=e.message;}).finally(()=>{geometryRequest=null;});
    await geometryRequest;
  }
  function clearDraft() {st.edit=false;st.dirty=false;}
  function chooseSeries(id) {
    clearDraft();
    st.series=id;
    st.captureGap=null;
    st.interval=intervals().at(-1)?.id||null;
    st.compareA=st.compareB=null;
    st.tab="data";
    render();
  }
  function chooseInterval(id, gap=null) {
    clearDraft();
    st.interval=id||null;
    st.captureGap=gap;
    st.compareA=null;
    st.compareB=st.interval;
    render();
  }
  function sync(section) {
    const previous=st.section; st.section=section; const show=section==="input";
    const atlas=show||section==="national";
    el.hidden=!show; document.body.classList.toggle("catalog-visible",atlas);
    document.body.classList.toggle("nc-atlas",atlas);
    document.body.classList.toggle("nc-atlas-annual",show && annualCaptures() && st.tab!=="compare");
    if(show&&el.querySelector("#ncDockBody"))updateDock();
    publishMap();
    if(previous!=="input" && show) {
      if(!st.loading)refresh();
    }
  }
  window.ContractData={sync,selectCommunity:selectRegion,mapReady:publishMap};
  function comparison() {
    const vs=intervals();if(vs.length<2)return null;
    if(!vs.some(v=>v.id===st.compareB))st.compareB=st.interval||vs.at(-1).id;
    if(!vs.some(v=>v.id===st.compareA)||st.compareA===st.compareB)st.compareA=vs.filter(v=>v.id!==st.compareB).at(-1).id;
    const a=vs.find(v=>v.id===st.compareA),b=vs.find(v=>v.id===st.compareB);
    const ar=records(a),br=records(b),pairs=core.compare(ar,br,st.communities,st.component);
    return {a,b,ar,br,pairs,range:core.domain([...ar,...br])};
  }
  function publishMap() {
    if(st.section==="national")return;
    const v=current(),cmp=st.tab==="compare"?comparison():null;
    const rows=cmp?cmp.ar:records(v||{rows:[]});
    const diff=cmp?cmp.pairs.map(r=>({ccaa_codigo:r.ccaa_codigo,value:st.component==="tendencias"?(r.paired?(r.changed?"changed":"same"):null):r.delta})):[];
    window.ContractLiveMap?.update({active:st.section==="input",geo:st.geo,component:st.component,rows,range:cmp?cmp.range:core.domain(rows),selected:st.mapCode,
      atlas:true,valueLabel:valueLabel(),trendScheme:getSeries()?.trend_scheme,
      title:cmp?(st.compareMode==="split"?"Comparación · misma escala de color":st.component==="tendencias"?"Cambios de categoría entre A y B":"Diferencia B − A"):v?`${getSeries().name} · ${period(v)}`:"Selecciona una serie y un intervalo de datos",
      mode:cmp?st.compareMode:"values",second:cmp?.br||[],difference:diff,differenceRange:core.domain(diff),labelA:cmp?period(cmp.a):"",labelB:cmp?period(cmp.b):""});
  }
  function comparisonControls() {
    const c=comparison();if(!c)return '<p class="nc-note">Añade dos intervalos a esta serie para compararlos.</p>';
    const choose=(id,label,value,other)=>`<label>${label}<select id="${id}">${intervals().map(v=>`<option value="${v.id}" ${v.id===value?"selected":""} ${v.id===other?"disabled":""}>${esc(period(v))}</option>`).join("")}</select></label>`;
    return `<section class="nc-side-section"><h3>${atlasHeading("compare","Comparación de intervalos")}</h3>${choose("ncCompareA","A · Referencia",c.a.id,c.b.id)}${choose("ncCompareB","B · Comparación",c.b.id,c.a.id)}${button("swap","Intercambiar A y B")}<div class="nc-mode-switch">${button("compare-split","Dos mapas",st.compareMode==="split")}${button("compare-difference",st.component==="tendencias"?"Cambios":"Diferencias",st.compareMode==="difference")}</div></section>`;
  }
  function mapChoices() {
    return Object.entries(components).map(([key,c])=>{
      const series=st.db.series.filter(s=>s.component===key);
      const ids=new Set(series.map(s=>s.id));
      const latest=st.db.intervals.filter(v=>ids.has(v.series_id)&&coverage(v)>0)
        .reduce((last,v)=>!last||last.end<v.end?v:last,null);
      return {key,label:c.map,series:series.length,latest};
    });
  }
  function coverage(interval) {
    return interval ? records(interval).filter(row=>core.present(row.value)).length : 0;
  }
  function atlasHeading(icon,title) {
    return `<span class="nc-atlas-heading"><i class="nc-heading-icon nc-heading-icon-${icon}" aria-hidden="true"></i><span>${title}</span></span>`;
  }
  function atlasSection(key,title,content,variant,label="") {
    return `<details class="nc-atlas-section ${variant}" data-atlas-section="${key}" ${atlasSections[key]?"open":""} ${label?`aria-label="${esc(label)}"`:""}>
      <summary>${atlasHeading(key,title)}</summary>
      ${content}
    </details>`;
  }
  function rememberAtlasSections() {
    for(const section of el.querySelectorAll("[data-atlas-section]")) {
      atlasSections[section.dataset.atlasSection]=section.open;
    }
  }
  function mapCards(choices) {
    const heading=`<strong class="nc-map-count">${choices.length}</strong> ${choices.length===1?"mapa":"mapas"}`;
    return atlasSection("maps",heading,`
      <div class="nc-atlas-cards" role="group" aria-label="Tipo de mapa">
        ${choices.map(c=>`<button type="button" data-nc="component" data-key="${c.key}" class="nc-map-card" aria-pressed="${c.key===st.component}">
          <canvas width="192" height="96" data-thumbnail="${c.key}" aria-hidden="true"></canvas>
          <strong>${c.label}</strong>
          <small>${c.latest?`${c.series} ${c.series===1?"serie":"series"}`:st.loading?"…":"Sin datos"}</small>
        </button>`).join("")}
      </div>`,"nc-atlas-maps","Mapas de datos");
  }
  function paintCards(choices) {
    if(!st.geo)return;
    for(const c of choices) {
      const layer=c.key===st.component?current():c.latest;
      window.ContractMaps.thumbnail(el.querySelector(`[data-thumbnail="${c.key}"]`),st.geo,layer?records(layer):[],c.key);
    }
  }
  function speciesHeading() {
    return `<header class="nc-atlas-species ${st.mapCode?"nc-atlas-species-compact":""}">
      <img class="nc-atlas-plate" src="/assets/atlas/tortolas-lilford-transparente.webp" width="1100" height="650" alt="Dos tórtolas europeas posadas en una rama">
      <div><h1>Tórtola europea</h1><p class="nc-atlas-latin" lang="la">Streptopelia turtur</p></div>
    </header>`;
  }
  function seriesPicker(series,selected) {
    if(series.length<=1)return `<label>Serie<select id="ncSeries" ${series.length?"":"disabled"}>${selected
      ?`<option value="${selected.id}">${esc(selected.name)}</option>`
      :`<option value="">${st.loading?"Cargando…":"Sin series"}</option>`}</select></label>`;
    return `<div class="nc-series-picker">
      <span>Series de ${components[st.component].map.toLowerCase()}</span>
      <details id="ncSeriesPicker">
        <summary>${esc(selected?.name||"Selecciona una serie")}</summary>
        <div class="nc-series-options">${series.map(s=>{
          const last=intervals(s.id).at(-1);
          const latest=last?period(last,s):"Sin intervalos";
          return `<button type="button" data-nc="series" data-id="${s.id}" aria-pressed="${s.id===st.series}"><strong>${esc(s.name)}</strong><small>${esc(s.source)} · ${esc(latest)}</small></button>`;
        }).join("")}</div>
      </details>
    </div>`;
  }
  function atlasSidebar(s,v,choices) {
    const series=st.db.series.filter(item=>item.component===st.component);
    const selectedYear=captureYear();
    const vs=intervals();
    const shownIntervals=annualCaptures()?vs.filter(item=>yearOf(item)===selectedYear):vs;
    const options=(items,selected,placeholder)=>`<option value="" ${selected?"":"selected"} disabled>${placeholder}</option>${items.map(x=>`<option value="${x.id}" ${selected===x.id?"selected":""}>${esc(period(x))}</option>`).join("")}`;
    const controls=`
      <div class="nc-atlas-filters">
        ${seriesPicker(series,s)}
        ${annualCaptures()&&shownIntervals.length<=1
          ?`<span class="nc-atlas-year"><small>Intervalo</small><strong>${esc(v?period(v):selectedYear??"—")}</strong></span>`
          :`<label>Intervalo<select id="ncInterval" ${shownIntervals.length?"":"disabled"}>${options(shownIntervals,st.interval,"Sin intervalos")}</select></label>`}
      </div>
      <div class="nc-atlas-tools">${button("manage-series","Gestionar series",false,`aria-controls="ncAtlasManage" aria-expanded="${st.atlasManaging}"`)}</div>
      <section class="nc-atlas-manage" id="ncAtlasManage" ${st.atlasManaging?"":"hidden"} aria-label="Gestión de datos">
        <div class="nc-actions">${button("new-series","Crear serie")}${s?button("edit-series","Editar serie")+'<button type="button" class="nc-danger" data-nc="delete-series">Eliminar serie</button>':""}</div>
        <div class="nc-actions">${s?button("new-interval","Añadir intervalo"):""}${v?button("edit-interval","Editar intervalo"):""}</div>
        <div class="nc-actions">${button("template","Plantilla Excel")}${v?button("import","Importar archivo")+button("edit","Editar tabla")+button("export","Descargar datos"):""}</div>
      </section>
      ${st.tab==="compare"?comparisonControls():""}`;
    return `<aside class="nc-side nc-atlas-side" data-component="${st.component}" aria-label="Datos de tórtola europea">
      ${speciesHeading()}
      ${mapCards(choices)}
      ${atlasSection("series","Serie e intervalo",controls,"nc-atlas-series")}
      ${statusMessage()}
      <div id="ncInspectorBody" class="nc-atlas-detail" aria-live="polite">${atlasDetail()}</div>
      ${st.geoError?`<p class="nc-error">${esc(st.geoError)}</p>${button("retry-map","Reintentar mapa")}`:""}
    </aside>`;
  }
  function statusMessage() {
    return `<div id="ncMessage" role="status" aria-live="polite">${st.message?`<p class="nc-success">${esc(st.message)}</p>`:""}${st.error?`<p class="nc-error">${esc(st.error)}</p>`:""}</div>`;
  }
  function atlasDetail() {
    const series=getSeries(), interval=current();
    const selected=st.communities.find(c=>c.code===st.mapCode);
    const source=series?`<details class="nc-atlas-source"><summary>${atlasHeading("info","Sobre estos datos")}</summary><p>${esc(series.definition)}</p><p>${esc(series.source)} · ${esc(series.unit)}</p></details>`:"";
    const count=coverage(interval);
    const hasGap=annualCaptures()&&st.captureGap!==null;
    if(!selected) {
      return `${interval||hasGap?`<p class="nc-atlas-coverage"><strong>${count} de ${st.communities.length}</strong> comunidades con datos</p>`:""}
        ${regionSelector("Comunidad","Elige en el mapa o en la lista")}${source}`;
    }
    const row=interval?.rows.find(r=>r.ccaa_codigo===selected.code);
    const values=communitySeries(selected.code);
    const component=components[st.component];
    const chart=st.component==="tendencias"?trendHistory(values):bars(values);
    const value=st.component==="tendencias"?trendMark(row?.value):esc(fmt(row?.value));
    const detail=st.tab==="compare"&&comparison()?mapDetail(false):`<div class="nc-atlas-value"><strong>${value}</strong><span>${esc(valueLabel())}</span></div>`;
    return `<div class="nc-atlas-region">
      ${button("clear-selection","← Vista nacional")}
      <h2 class="nc-atlas-place">${esc(selected.name)}</h2>
      ${interval||hasGap?detail:""}
      ${values.length?atlasSection("chart","Por intervalo",chart,"nc-atlas-chart",`${component.map} de ${selected.name}`):'<p class="nc-muted">Sin intervalos en esta serie.</p>'}
      ${row?.observations?`<p class="nc-atlas-observation">${esc(row.observations)}</p>`:""}
      <details class="nc-atlas-territory"><summary>${atlasHeading("place","Cambiar comunidad")}</summary>${regionSelector()}</details>
      ${source}
    </div>`;
  }
  function captureCalendar() {
    const byYear=new Map();
    for(const v of intervals()) {
      const year=yearOf(v);
      if(!byYear.has(year))byYear.set(year,[]);
      byYear.get(year).push(v);
    }
    const years=[...byYear.keys()];
    if(!years.length)return [];
    return Array.from({length:years.at(-1)-years[0]+1},(_,i)=>{
      const year=years[0]+i;
      return {year,entries:byYear.get(year)||[]};
    });
  }
  function captureTimeline() {
    if(!annualCaptures()||st.tab==="compare")return "";
    const calendar=captureCalendar(),selected=captureYear();
    const total=st.communities.length;
    return `<section class="nc-annual" aria-label="Capturas por año">
      <div class="nc-annual-heading"><strong>${atlasHeading("series","Capturas por año")}</strong>
        <span>${selected===null?"Sin años cargados":`${selected} · ${coverage(current())} de ${total} comunidades con datos`}</span>
      </div>
      ${calendar.length?`<div class="nc-annual-track" role="group" aria-label="Año de inicio del intervalo">
        ${calendar.map(({year,entries})=>{
          const v=year===selected?current():entries.at(-1),n=coverage(v);
          const state=!n?"empty":n===total?"complete":"partial";
          const label=`${year} · ${n} de ${total} comunidades con datos`;
          return `<button type="button" data-nc="capture-year" data-year="${year}" data-state="${state}" aria-pressed="${year===selected}" aria-label="${label}" title="${label}"><i aria-hidden="true"></i>${year}</button>`;
        }).join("")}
      </div>`:""}
    </section>`;
  }
  function communitySeries(code) {
    const value=v=>v?.rows.find(row=>row.ccaa_codigo===code)?.value??null;
    const point=(v,name)=>({name,value:value(v),active:st.interval===v.id});
    if(annualCaptures())return captureCalendar().flatMap(({year,entries})=>
      entries.length?entries.map(v=>point(v,period(v)))
      :[{name:String(year),value:null,active:st.captureGap===year}]);
    return intervals().map(v=>point(v,period(v)));
  }
  function trendMark(value) {
    const icon=core.trendIcons[value];
    const color=icon?window.ContractMaps.color(value,"tendencias",null,"values"):"#626752";
    return `<span class="nc-trend-mark" style="--trend-color:${color}">${icon?`<i aria-hidden="true">${icon}</i>`:""}${esc(fmt(value))}</span>`;
  }
  function trendHistory(rows) {
    return `<ol class="nc-trend-history">${rows.map(row=>`<li class="${row.active?"nc-bar-active":""}">
      <span>${esc(row.name)}</span>${trendMark(row.value)}
    </li>`).join("")}</ol>`;
  }
  function render() {
    rememberAtlasSections();
    const s=getSeries(),v=current(),choices=mapChoices();
    if(st.tab==="compare")comparison();
    const emptyTitle=st.captureGap!==null?`Sin datos para ${st.captureGap}`:s?"Añade un intervalo para incorporar datos":"Crea o selecciona una serie";
    const dock=st.tab==="compare"&&s?compareView():!v?`<div class="nc-start"><h3>${emptyTitle}</h3></div>`
      :st.tab==="explore"?exploreView():st.tab==="history"?historyView():dataView();
    el.innerHTML=`${atlasSidebar(s,v,choices)}${captureTimeline()}
      <section class="nc-dock">${window.ContractDock.grip("ncDockBody")}<header class="nc-dock-header"><div class="nc-tabs" role="tablist">${[["data","Tabla"],["explore","Gráficos"],["compare","Comparar"],["history","Revisiones"]].map(([key,label])=>`<button type="button" role="tab" aria-selected="${st.tab===key}" data-nc="tab" data-tab="${key}" class="${st.tab===key?"active":""}">${label}</button>`).join("")}</div>${window.ContractDock.toggle("ncDockBody",'data-nc="dock-collapse"')}</header><div id="ncDockBody" class="nc-dock-body" role="tabpanel">${dock}</div></section>`;
    paintCards(choices);
    sync(st.section);
    revealActiveYear();
  }
  function updateDock() {
    window.ContractDock.sync(el,st.dockCollapsed,st.edit);
  }
  function revealActiveYear() {
    const track=el.querySelector(".nc-annual-track");
    const button=track?.querySelector('[aria-pressed="true"]');
    if(!button)return;
    track.scrollLeft=button.offsetLeft-(track.clientWidth-button.offsetWidth)/2;
  }
  function dataView() {
    const label=esc(valueLabel()),all=records(),rows=st.mapCode&&!st.tableAll&&!st.edit?all.filter(r=>r.ccaa_codigo===st.mapCode):all,n=all.filter(r=>core.present(r.value)).length;
    const scheme=getSeries()?.trend_scheme;
    const trendOptions=Object.entries(core.trendLabels(scheme));
    const missingNote=scheme==="seis_categorias"?"«Incierta» indica una evaluación con incertidumbre. Las filas sin evaluación se muestran como «Sin datos».":"Sin datos no equivale a cero ni a una tendencia constante. Puedes completar la información más adelante.";
    return `<div class="nc-row"><p class="nc-muted"><b>${n} de ${st.communities.length}</b> comunidades con datos · ${st.communities.length-n} sin datos${st.mapCode?` · Selección: ${esc(st.communities.find(c=>c.code===st.mapCode)?.name)}`:""}</p><div class="nc-actions">${st.mapCode&&!st.edit?button("table-scope",st.tableAll?"Solo seleccionada":"Mostrar todas"):""}${st.edit?button("cancel-edit","Cancelar edición")+button("review","Revisar y guardar",true):button("template","Plantilla Excel")+button("import","Importar archivo")+button("export","Descargar datos")+button("edit","Editar tabla",true)}</div></div>
      <p class="nc-muted">${st.edit?"Dejar una celda vacía conserva el dato guardado. Para retirarlo, marca «Retirar dato» y explica el motivo al guardar.":missingNote}</p>
      ${rowTable(["Comunidad autónoma",label,"Observaciones",...(st.edit?["Retirar dato"]:[])],rows.map(r=>`<tr data-code="${r.ccaa_codigo}" class="${r.ccaa_codigo===st.mapCode?"nc-selected-row":""}"><td><small>${r.ccaa_codigo}</small> ${esc(r.name)}</td><td>${st.edit?(st.component==="tendencias"?`<select data-value aria-label="Tendencia de ${esc(r.name)}"><option value="">Sin datos</option>${trendOptions.map(([k,l])=>`<option value="${k}" ${r.value===k?"selected":""}>${l}</option>`).join("")}</select>`:`<input data-value type="number" step="${st.component==="historico_caza"?"1":"any"}" ${st.component==="historico_caza"?'min="0"':""} value="${esc(r.value)}" placeholder="Sin datos" aria-label="${label} de ${esc(r.name)}">`):`<span class="${!core.present(r.value)?"nc-missing":r.value===0?"nc-zero":""}">${esc(fmt(r.value))}</span>`}</td><td>${st.edit?`<input data-note maxlength="1500" value="${esc(r.observations)}" aria-label="Observaciones de ${esc(r.name)}">`:esc(r.observations)||"—"}</td>${st.edit?`<td><input type="checkbox" data-clear aria-label="Retirar dato de ${esc(r.name)}" ${!core.present(r.value)?"disabled":""}></td>`:""}</tr>`))}`;
  }
  function stat(value,label) {return `<div class="nc-stat"><strong>${esc(fmt(value))}</strong><span>${label}</span></div>`;}
  function mapPending() {
    return st.geoError?`<p class="nc-error">No se pudo cargar el mapa: ${esc(st.geoError)}</p>${button("retry-map","Reintentar mapa")}`:'<p class="nc-muted" role="status">Cargando los límites de las comunidades…</p>';
  }
  function regionSelector(label="Consultar comunidad",placeholder="Selecciona una comunidad") {
    return `<label class="nc-region-select">${label}<select id="ncMapCommunity"><option value="">${placeholder}</option>${st.communities.map(c=>`<option value="${c.code}" ${st.mapCode===c.code?"selected":""}>${esc(c.name)}</option>`).join("")}</select></label>`;
  }
  function mapDetail(showTitle=true) {
    if(!st.mapCode)return '<p class="nc-muted">Pulsa una comunidad en el mapa o selecciónala en la lista para consultar sus valores y observaciones.</p>';
    const name=st.communities.find(c=>c.code===st.mapCode)?.name,s=getSeries();
    const ids=st.tab==="compare"?[st.compareA,st.compareB]:[st.interval];
    return `${showTitle?`<h3>${esc(name)}</h3>`:""}<p class="nc-muted">${esc(s.name)} · Fuente: ${esc(s.source)}</p><div class="nc-detail-columns">${ids.map(id=>{const v=st.db.intervals.find(v=>v.id===id);if(!v)return "";const r=v.rows.find(r=>r.ccaa_codigo===st.mapCode);return `<div><b>${esc(period(v))}</b><strong class="nc-region-value">${esc(fmt(r?.value))}</strong><p>${esc(r?.observations)||"Sin observaciones."}</p></div>`;}).join("")}</div>`;
  }
  function selectRegion(code) {
    if(code&&code!==st.mapCode) {
      const chart=el.querySelector('[data-atlas-section="chart"]');
      if(chart)chart.open=true;
      atlasSections.chart=true;
    }
    st.mapCode=code||null;st.community=code||"all";st.tableAll=false;
    if(st.edit){
      rememberAtlasSections();
      const body=el.querySelector("#ncInspectorBody");if(body)body.innerHTML=atlasDetail();
      el.querySelector(".nc-atlas-species")?.classList.toggle("nc-atlas-species-compact",Boolean(code));
      el.querySelectorAll("tr[data-code]").forEach(row=>row.classList.toggle("nc-selected-row",row.dataset.code===code));
      el.querySelector(`tr[data-code="${code}"]`)?.scrollIntoView({block:"nearest"});
      publishMap();
    }else {
      render();
      if(code&&window.matchMedia("(max-width:580px)").matches) {
        el.querySelector(".nc-atlas-chart")?.scrollIntoView({block:"nearest"});
      }
    }
  }
  function compareView() {
    const c=comparison();if(!c)return '<div class="nc-start"><h3>Añade otro intervalo para comparar</h3><p>Se necesitan dos intervalos de la misma serie. Puedes añadirlos desde el lateral.</p></div>';
    const paired=c.pairs.filter(r=>r.paired),trend=st.component==="tendencias",rows=st.mapCode&&!st.tableAll?c.pairs.filter(r=>r.ccaa_codigo===st.mapCode):c.pairs;
    return `<div class="nc-row"><p class="nc-muted">${paired.length} comunidades con datos en ambos · ${st.communities.length-paired.length} sin pareja. ${trend?"Cambios de categoría, sin puntuación numérica.":"Diferencia B − A, sin normalizar por duración."}</p>${st.mapCode?button("table-scope",st.tableAll?"Solo seleccionada":"Mostrar todas"):""}</div>${rowTable(["Comunidad",`A · ${esc(period(c.a))}`,`B · ${esc(period(c.b))}`,trend?"Transición A → B":"Diferencia B − A"],rows.map(r=>`<tr data-compare-code="${r.ccaa_codigo}" data-region-row="${r.ccaa_codigo}" class="${r.ccaa_codigo===st.mapCode?"nc-selected-row":""}"><td>${esc(r.name)}</td><td>${esc(fmt(r.a))}</td><td>${esc(fmt(r.b))}</td><td>${!r.paired?"Sin pareja de datos":trend?`${esc(fmt(r.a))} → ${esc(fmt(r.b))}`:esc(fmt(r.delta))}</td></tr>`))}`;
  }
  function bars(rows) {
    const values=rows.filter(r=>core.present(r.value)).map(r=>Number(r.value));
    const min=Math.min(0,...values),max=Math.max(0,...values),span=max-min||1,zero=-min/span*100;
    return `<div class="nc-bars">${rows.map(r=>{
      const hasValue=core.present(r.value),value=Number(r.value);
      return `<div class="nc-bar-row ${r.active?"nc-bar-active":""} ${hasValue?"":"nc-bar-missing"}"><span>${esc(r.name)}</span><span class="nc-bar-track" aria-hidden="true">${hasValue?`<span class="nc-bar-fill ${value===0?"nc-bar-zero":""}" style="left:${Math.min(zero,(value-min)/span*100)}%;width:${Math.abs(value)/span*100}%"></span>`:""}<span class="nc-bar-axis" style="left:${zero}%"></span></span><span>${esc(fmt(r.value))}</span></div>`;
    }).join("")}</div>`;
  }
  function exploreView() {
    const all=records(),rows=all,d=core.describe(rows,st.component,rows.length,getSeries()?.trend_scheme);
    const filter=`<label>Comunidad<select id="ncCommunity"><option value="all">Todas las comunidades</option>${st.communities.map(c=>`<option value="${c.code}" ${st.community===c.code?"selected":""}>${esc(c.name)}</option>`).join("")}</select></label>`;
    const coverage=`<div class="nc-stats">${stat(d.n,"Con datos")}${stat(d.missing,"Sin datos")}${stat(Math.round(d.coverage)+" %","Cobertura")}</div>`;
    let summary,chart;
    if(st.component==="tendencias") {
      summary=`<div class="nc-stats">${Object.entries(d.counts).map(([k,n])=>stat(n,core.labels[k])).join("")}</div>`;
      chart=`<div class="nc-chart"><h3>Distribución de tendencias</h3>${bars(Object.entries(d.counts).map(([k,n])=>({name:core.labels[k],value:n})))}<p class="nc-muted">Recuentos de comunidades. Las categorías no se convierten en números ni se promedian. Los ausentes quedan fuera.</p>${rowTable(["Categoría","Comunidades","% de evaluadas"],Object.entries(d.counts).map(([k,n])=>`<tr><td>${core.labels[k]}</td><td>${n}</td><td>${d.n?fmt(n/d.n*100)+" %":"—"}</td></tr>`))}</div>`;
    } else {
      summary=`<div class="nc-stats">${stat(d.min,"Mínimo")}${stat(d.max,"Máximo")}${stat(d.mean,"Media sin ponderar")}${stat(d.median,"Mediana")}${stat(d.sd,"Desv. típica muestral")}${annualCaptures()?stat(d.sum,"Suma de capturas observadas"):""}</div>`;
      const nums=rows.filter(r=>core.present(r.value)).map(r=>Number(r.value)),bins=[];
      if(nums.length) { const min=Math.min(...nums),max=Math.max(...nums),count=min===max?1:Math.min(5,Math.ceil(Math.sqrt(nums.length))),width=(max-min)/count||1;for(let i=0;i<count;i++){const lo=min+i*width,hi=i===count-1?max:min+(i+1)*width;bins.push({lo,hi,n:nums.filter(x=>x>=lo&&(i===count-1?x<=hi:x<hi)).length});}}
      chart=`<div class="nc-chart"><h3>Valores por comunidad</h3>${bars([...rows].sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity)))}<p class="nc-muted">Comparación descriptiva dentro de la misma serie y el mismo intervalo.</p></div><div class="nc-chart"><h3>Distribución de los valores</h3>${bins.length?`<div class="nc-histogram" role="img" aria-label="Histograma de los valores observados">${bins.map(b=>`<div class="nc-bin"><span>${b.n}</span><i style="height:${b.n/Math.max(...bins.map(x=>x.n))*110}px"></i><small>${esc(fmt(b.lo))}–${esc(fmt(b.hi))}</small></div>`).join("")}</div><p class="nc-muted">Frecuencia por intervalo de valores. Último intervalo cerrado.</p>${rowTable(["Resumen","Valor"],[["Primer cuartil",d.q1],["Mediana",d.median],["Tercer cuartil",d.q3]].map(([k,v])=>`<tr><td>${k}</td><td>${esc(fmt(v))}</td></tr>`))}`:'<p class="nc-muted">Añade valores para ver la distribución.</p>'}</div>`;
    }
    const vs=intervals(),codes=st.community==="all"?st.communities:st.communities.filter(c=>c.code===st.community);
    const matrix=rowTable(["Comunidad",...vs.map(v=>esc(period(v)))],codes.map(c=>`<tr><td>${esc(c.name)}</td>${vs.map(v=>{const r=v.rows.find(r=>r.ccaa_codigo===c.code);return `<td class="${core.present(r?.value)?"nc-cell-present":"nc-cell-missing"}">${esc(fmt(r?.value))}</td>`;}).join("")}</tr>`));
    let timeline="";
    if(st.community!=="all") {
      const points=vs.map(v=>({name:period(v),value:v.rows.find(r=>r.ccaa_codigo===st.community)?.value??null}));
      timeline=`<h3>Historia de la comunidad seleccionada</h3>${st.component==="tendencias"?rowTable(["Intervalo","Tendencia"],points.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(fmt(r.value))}</td></tr>`)):bars(points)}<p class="nc-muted">Orden por fecha de inicio. No se rellenan huecos ni se ajusta un modelo de tendencia.</p>`;
    }
    return `<div class="nc-row"><div><h3>Exploración descriptiva</h3><p class="nc-muted">${esc(period(current()))}</p></div>${filter}</div>${coverage}${summary}<p class="nc-note">${st.component==="abundancias"?"La media resume los índices de las comunidades con datos, sin ponderación. No es una estimación de abundancia nacional; los índices no se suman.":captureAverage()?"Cada valor es el promedio anual del intervalo de referencia.":annualCaptures()?"La suma incluye solo las comunidades con datos de este intervalo; si falta alguna, no representa un total nacional completo.":"Constante es una evaluación de estabilidad; no sustituye a Sin datos."} Estos resúmenes no calculan cupos ni infieren tendencias ecológicas.</p><div class="nc-charts">${chart}</div><div style="margin-top:25px"><h3>Cobertura e historia de la serie</h3><p class="nc-muted">Verde: dato disponible, incluido cero. Beige: sin datos. ${vs.length} intervalos; no se mezclan otras series.</p>${matrix}${timeline}</div>`;
  }
  function historyView() {
    const entries=st.history.filter(h=>h.event.target===st.interval||h.event.target===st.series);
    return `<h3>Revisiones de esta serie e intervalo</h3><p class="nc-muted">Cada guardado conserva el estado anterior. El acceso actual es compartido: no se atribuyen cambios a usuarios individuales.</p>${rowTable(["Revisión","Fecha","Cambio","Motivo","Consultar"],entries.map(h=>`<tr><td>r${h.revision}</td><td>${esc(new Date(h.event.at).toLocaleString("es-ES"))}</td><td>${({series:"Ficha de serie",interval:"Ficha de intervalo",records:"Datos"})[h.event.kind]}</td><td class="nc-history-reason">${esc(h.event.reason)}</td><td>${button("snapshot","Ver datos",false,`data-revision="${h.revision}"`)}</td></tr>`))}`;
  }
  function showModal(title,body,onSubmit,submitLabel="Guardar",submitClass="nc-primary") {
    dialog.innerHTML=`<form id="ncForm"><header><h2>${title}</h2><button type="button" data-close aria-label="Cerrar">×</button></header>${body}<p id="ncFormError" class="nc-error" role="alert" hidden></p><footer><button type="button" data-close>Cancelar</button><button class="${submitClass}" type="submit">${submitLabel}</button></footer></form>`;
    dialog.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>dialog.close());
    dialog.querySelector("form").onsubmit=async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;try{await onSubmit(new FormData(e.target));}catch(err){const box=dialog.querySelector("#ncFormError");box.textContent=err.message;box.hidden=false;}finally{btn.disabled=false;}};
    dialog.showModal();
  }
  async function save(payload) {
    const r=await api("",{revision:st.db.revision,...payload});st.db=r.catalog;clearDraft();st.error="";st.message=`Guardado como revisión ${st.db.revision}.`;
    dialog.close();
  }
  const input=(name,label,value="",type="text",required=true,extra="")=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${required?"required":""} ${extra}></label>`;
  function seriesForm(edit=false) {
    const s=edit?getSeries():{component:st.component},locked=edit&&intervals().length>0;
    const scheme=s.trend_scheme||(edit?"tres_categorias":"seis_categorias");
    const classification=st.component==="tendencias"?`<label class="wide">Categorías de tendencia
      <select name="trend_scheme" ${locked?"disabled":""}>
        <option value="seis_categorias" ${scheme==="seis_categorias"?"selected":""}>6 categorías · Pendiente anual e intervalo de confianza</option>
        <option value="tres_categorias" ${scheme==="tres_categorias"?"selected":""}>3 categorías · En alza, decrecimiento, constante</option>
      </select>
    </label>`:"";
    showModal(edit?"Editar serie":"Crear serie de "+components[st.component].name.toLowerCase(),`<p>Tórtola europea · Comunidades autónomas. Esta ficha se crea una vez; después añadirás sus intervalos y datos.</p>${locked?'<p class="nc-note">La serie ya tiene intervalos. Puedes corregir nombre y fuente. Un indicador o escala diferentes requieren otra serie.</p>':""}<div class="nc-form-grid">${input("name","Nombre de la serie",s.name||"","text",true,'maxlength="120"')}${input("source","Fuente o entidad responsable",s.source||"","text",true,'maxlength="300"')}<label class="wide">Qué mide y cómo se interpreta<textarea name="definition" required maxlength="1500" ${locked?"readonly":""}>${esc(s.definition)}</textarea></label>${input("interval_type","Tipo de intervalo (año, temporada…)",s.interval_type||"Anual","text",true,locked?"readonly":"")}${input("unit",st.component==="tendencias"?"Criterio de clasificación":st.component==="abundancias"?"Unidad o escala del índice":"Qué se cuenta",s.unit||(st.component==="historico_caza"?"Individuos capturados":""),"text",true,locked?"readonly":"")}${classification}${st.component==="abundancias"?input("minimum","Mínimo permitido (opcional)",s.minimum??"","number",false,`step="any" ${locked?"readonly":""}`)+input("maximum","Máximo permitido (opcional)",s.maximum??"","number",false,`step="any" ${locked?"readonly":""}`):""}${edit?`<label class="wide">Motivo del cambio<input name="reason" required maxlength="500"></label>`:""}</div>`,async fd=>{
      const item={...s,...Object.fromEntries(fd)};delete item.reason;
      await save({action:"series",series:item,reason:fd.get("reason")||"Creación de serie"});
      if(edit)render();
      else chooseSeries(st.db.series.at(-1).id);
    });
  }
  function deleteSeries() {
    const series=getSeries();
    if(!series)return;
    const count=intervals().length;
    const impact=count===0?"La serie no tiene intervalos.":`Se retirarán ${count===1?"su intervalo y sus datos":`sus ${count} intervalos y sus datos`} del catálogo actual.`;
    showModal("Eliminar serie",`<p>Vas a eliminar la serie <strong>${esc(series.name)}</strong>.</p><p>${impact} Las revisiones anteriores se conservan.</p>${st.dirty?"<p>También se descartarán los cambios sin guardar.</p>":""}${input("reason","Motivo de la eliminación","","text",true,'maxlength="500"')}`,async fd=>{
      await save({action:"delete-series",series_id:series.id,reason:fd.get("reason")});
      reconcileSelection();
      st.message=`Serie eliminada. Revisión ${st.db.revision}.`;
      render();
    },"Eliminar serie","nc-danger");
  }
  function intervalForm(edit=false) {
    const year=st.captureGap!==null?String(st.captureGap).padStart(4,"0"):null;
    const v=edit?current():year?{name:year,start:`${year}-01-01`,end:`${year}-12-31`}:{};
    showModal(edit?"Editar intervalo de datos":"Añadir intervalo de datos",`<p>Indica las fechas que cubren los datos de la serie <b>${esc(getSeries().name)}</b>.</p><div class="nc-form-grid"><label class="wide">Nombre del intervalo<input name="name" required maxlength="120" placeholder="Ej. 2021–2025" value="${esc(v.name)}"></label>${input("start","Fecha de inicio",v.start||"","date")}${input("end","Fecha de fin",v.end||"","date")}${edit?'<label class="wide">Motivo de la corrección<input name="reason" required maxlength="500"></label>':""}</div>`,async fd=>{
      const item={...v,...Object.fromEntries(fd),series_id:st.series};
      delete item.reason;
      await save({action:"interval",interval:item,reason:fd.get("reason")||"Creación de intervalo"});
      st.tab="data";
      chooseInterval(edit?v.id:st.db.intervals.at(-1).id);
    });
  }
  function review(rows,clear=[],origin="edit") {
    const changes=core.changes(current().rows,rows,clear),count=changes.filter(r=>r.changed).length;
    showModal("Revisar cambios antes de guardar",`<p><b>${esc(getSeries().name)} · ${esc(period(current()))}</b></p><p>${count} filas con cambios. Los vacíos conservan los valores existentes; solo las retiradas explícitas los eliminan.</p>${rowTable(["Comunidad","Anterior","Nuevo","Cambio"],changes.map(r=>`<tr><td>${esc(st.communities.find(c=>c.code===r.ccaa_codigo)?.name||r.ccaa_codigo)}</td><td>${esc(fmt(r.old))}</td><td>${esc(fmt(r.value))}</td><td>${esc(r.status)}</td></tr>`))}<label>Motivo de la entrega o corrección<input name="reason" required maxlength="500" placeholder="Ej. Resultados del seguimiento 2026"></label>`,async fd=>{if(!count)throw new Error("No hay cambios que guardar.");await save({action:"records",interval_id:st.interval,rows,clear,origin,reason:fd.get("reason")});render();},"Confirmar y guardar revisión");
  }
  async function importFile(file) {
    if(!file)return;if(file.size>2e6)throw new Error("El archivo supera 2 MB.");
    const content=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(",")[1]);r.onerror=reject;r.readAsDataURL(file);});
    const r=await api("/inspect",{interval_id:st.interval,filename:file.name,content});
    if(r.revision!==st.db.revision)throw new Error("Los datos han cambiado. Actualiza la página antes de importar.");
    review(r.rows,[],"import");
  }
  el.addEventListener("click",async event=>{
    const b=event.target.closest("[data-nc]");if(!b){const row=event.target.closest("tr[data-code],tr[data-region-row]");if(row&&!st.edit)selectRegion(row.dataset.code||row.dataset.regionRow);return;}const action=b.dataset.nc;
    if(action==="manage-series") {
      st.atlasManaging=!st.atlasManaging;
      el.querySelector("#ncAtlasManage").hidden=!st.atlasManaging;
      b.setAttribute("aria-expanded",String(st.atlasManaging));
      return;
    }
    if(action==="dock-collapse") {
      st.dockCollapsed=!st.dockCollapsed;
      updateDock();
      return;
    }
    if(action==="tab" && b.dataset.tab===st.tab) {
      st.dockCollapsed=false;
      updateDock();
      return;
    }
    if(action==="capture-year") {
      const year=Number(b.dataset.year);
      if(year===captureYear()||!guard())return;
      const v=intervals().filter(v=>yearOf(v)===year).at(-1);
      chooseInterval(v?.id,v?null:year);
      el.querySelector(`[data-nc="capture-year"][data-year="${year}"]`)?.focus({preventScroll:true});
      return;
    }
    if(["component","series","tab","new-interval","edit-interval","edit-series","new-series","import"].includes(action)&&!guard())return;
    try {
      st.error="";st.message="";
      if(action==="component"&&st.component!==b.dataset.key){st.component=b.dataset.key;st.dockCollapsed=true;chooseSeries(st.db.series.find(s=>s.component===st.component)?.id||null);}
      if(action==="series"){chooseSeries(b.dataset.id);el.querySelector("#ncSeriesPicker summary")?.focus({preventScroll:true});}
      if(action==="tab"){clearDraft();st.dockCollapsed=false;st.tab=b.dataset.tab;if(st.tab==="history")st.history=(await api("/history")).history;render();if(["map","compare"].includes(st.tab)){await ensureGeometry();render();}}
      if(action==="new-series"||action==="edit-series"){clearDraft();render();seriesForm(action==="edit-series");}
      if(action==="delete-series")deleteSeries();
      if(action==="new-interval"||action==="edit-interval"){clearDraft();render();intervalForm(action==="edit-interval");}
      if(action==="region")selectRegion(b.dataset.code);
      if(action==="clear-selection")selectRegion(null);
      if(action==="zoom-selection")window.ContractLiveMap.fit(st.mapCode);
      if(action==="table-scope"){st.tableAll=!st.tableAll;render();}
      if(action==="compare-split"||action==="compare-difference"){st.compareMode=action==="compare-split"?"split":"difference";render();}
      if(action==="swap"){[st.compareA,st.compareB]=[st.compareB,st.compareA];render();}
      if(action==="retry-map"){st.geoError="";render();await ensureGeometry();render();}
      if(action==="template")download("template");
      if(action==="export")download("export");
      if(action==="edit"){st.tab="data";st.edit=true;st.dockCollapsed=false;render();}
      if(action==="cancel-edit"&&guard()){clearDraft();render();refresh();}
      if(action==="review"){
        const clear=[],rows=Array.from(el.querySelectorAll("tr[data-code]")).map(tr=>{if(tr.querySelector("[data-clear]").checked)clear.push(tr.dataset.code);const inp=tr.querySelector("[data-value]");if(!inp.checkValidity())throw new Error("Revisa los valores numéricos de la tabla.");return {ccaa_codigo:tr.dataset.code,value:inp.value||null,observations:tr.querySelector("[data-note]").value};});
        review(rows,clear);
      }
      if(action==="import") {clearDraft();render();const f=document.createElement("input");f.type="file";f.accept=".xlsx,.csv";f.onchange=()=>importFile(f.files[0]).catch(err=>{st.error=err.message;render();});f.click();}
      if(action==="snapshot") {
        const r=await api(`/snapshot?revision=${b.dataset.revision}`),v=r.catalog.intervals.find(x=>x.id===st.interval);
        showModal(`Revisión ${b.dataset.revision}`,`<p>Consulta de solo lectura. ${esc(v?period(v,r.catalog.series.find(s=>s.id===v.series_id)):"El intervalo aún no existía en esta revisión.")}</p>${rowTable(["Comunidad","Valor","Observaciones"],records(v||{rows:[]}).map(row=>`<tr><td>${esc(row.name)}</td><td>${esc(fmt(row.value))}</td><td>${esc(row.observations)}</td></tr>`))}`,async()=>dialog.close(),"Cerrar");
      }
    } catch(err){st.error=err.message;const msg=el.querySelector("#ncMessage");if(msg)msg.innerHTML=`<p class="nc-error" role="alert">${esc(err.message)}</p>`;}
  });
  el.addEventListener("input",e=>{if(e.target.matches("[data-value],[data-note],[data-clear]"))st.dirty=true;});
  el.addEventListener("change",e=>{
    if(e.target.id==="ncSeries") {
      if(!guard()){e.target.value=st.series;return;}
      chooseSeries(e.target.value);
    }
    if(e.target.id==="ncInterval") {if(!guard()){e.target.value=st.interval;return;}chooseInterval(e.target.value);}
    if(e.target.id==="ncCommunity")selectRegion(e.target.value==="all"?null:e.target.value);
    if(e.target.id==="ncMapCommunity")selectRegion(e.target.value);
    if(e.target.id==="ncCompareA"){st.compareA=e.target.value;render();}
    if(e.target.id==="ncCompareB"){st.compareB=e.target.value;render();}
  });
  document.querySelector(".topbar nav").addEventListener("click",e=>{if(!e.target.closest("button"))return;if(!guard()){e.preventDefault();e.stopImmediatePropagation();return;}clearDraft();},true);
  window.addEventListener("beforeunload",e=>{if(st.dirty){e.preventDefault();e.returnValue="";}});
  el.addEventListener("keydown",e=>{if(e.target.matches(".nc-region")&&["Enter"," "].includes(e.key)){e.preventDefault();selectRegion(e.target.dataset.code);}});
  window.addEventListener("focus",()=>refresh());
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
  setInterval(()=>{if(!document.hidden && st.section==="input")refresh();},30000);
  render();load().then(async()=>{render();await ensureGeometry();render();}).catch(err=>{st.loading=false;st.error=err.message;render();});
})();
