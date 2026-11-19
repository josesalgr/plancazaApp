/* Bridge onto the existing MapLibre instance. The map DOM survives panel updates. */
window.ContractLiveMap=(()=>{
  let primary=null,secondary=null,packet=null,active=false,initialized=false,syncing=false,primaryReady=false,secondaryReady=false,planningSplit=false;
  const savedVisibility=new Map();
  const empty={type:"FeatureCollection",features:[]};
  const fmt=v=>typeof v==="number"?new Intl.NumberFormat("es-ES",{maximumFractionDigits:3}).format(v):v;
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function atlasBasemap(map,visible) {
    if(visible&&!map.getSource("nc-atlas-land")) {
      map.addSource("nc-atlas-land",{type:"geojson",data:"/assets/atlas/land.geojson",attribution:'<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>'});
      map.addLayer({id:"nc-atlas-water",type:"background",paint:{"background-color":"#dce8e9"}},"osm");
      map.addLayer({id:"nc-atlas-land",type:"fill",source:"nc-atlas-land",paint:{"fill-color":"#f4f0e7"}},"osm");
      map.addLayer({id:"nc-atlas-coast",type:"line",source:"nc-atlas-land",paint:{"line-color":"#c4ceca","line-width":.8}},"osm");
    }
    map.setLayoutProperty("osm","visibility",visible?"none":"visible");
    for(const id of ["nc-atlas-water","nc-atlas-land","nc-atlas-coast"]) {
      if(map.getLayer(id))map.setLayoutProperty(id,"visibility",visible?"visible":"none");
    }
  }
  function prepare(map) {
    if(map.getSource("nc-contract"))return;
    const data=new Uint8Array(8*8*4);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){const i=(y*8+x)*4,d=(x+y)%8<2;data.set(d?[175,163,146,255]:[239,235,228,255],i);}
    map.addImage("nc-absent",{width:8,height:8,data});
    const muted=new Uint8Array(data.length);
    for(let i=0;i<muted.length;i+=4)muted.set(data[i]===175?[177,173,156,255]:[248,246,236,255],i);
    map.addImage("nc-atlas-absent",{width:8,height:8,data:muted});
    map.addSource("nc-contract",{type:"geojson",data:empty});
    map.addLayer({id:"nc-fill",type:"fill",source:"nc-contract",filter:["==",["get","nc_missing"],false],paint:{"fill-color":["get","nc_color"],"fill-opacity":.82}});
    map.addLayer({id:"nc-missing",type:"fill",source:"nc-contract",filter:["==",["get","nc_missing"],true],paint:{"fill-pattern":"nc-absent","fill-opacity":.82}});
    map.addLayer({id:"nc-outline",type:"line",source:"nc-contract",paint:{"line-color":"#526c61","line-width":1}});
    map.addLayer({id:"nc-selection",type:"line",source:"nc-contract",filter:["==",["get","ccaa_codigo"],""],paint:{"line-color":"#12382c","line-width":3}});
    map.on("click",event=>{
      if(!active)return;
      const feature=map.queryRenderedFeatures(event.point,{layers:["nc-fill","nc-missing"]})[0];
      if(feature)(packet.onSelect||window.ContractData.selectCommunity)(feature.properties.ccaa_codigo);
    });
    let popup;
    map.on("mousemove",event=>{
      if(!active)return;
      const feature=map.queryRenderedFeatures(event.point,{layers:["nc-fill","nc-missing"]})[0];
      map.getCanvas().style.cursor=feature?"pointer":"";
      if(!feature||!packet?.atlas||packet.mode!=="values") {popup?.remove();return;}
      const {comunidad,nc_value}=feature.properties;
      const core=window.ContractCore;
      const value=nc_value==null?"Sin datos":core.labels[nc_value]?`${core.trendIcons[nc_value]} ${core.labels[nc_value]}`:fmt(nc_value);
      popup??=new maplibregl.Popup({closeButton:false,offset:14,className:"nc-atlas-tooltip"});
      popup.setLngLat(event.lngLat).setHTML(`<strong>${esc(comunidad)}</strong><span>${esc(value)}</span>`);
      if(!popup.isOpen())popup.addTo(map);
    });
    map.getCanvas().addEventListener("mouseleave",()=>popup?.remove());
    map.on("click",()=>popup?.remove());
    map.on("movestart",()=>popup?.remove());
  }
  function showLayers(map,visible) {for(const id of ["nc-fill","nc-missing","nc-outline","nc-selection"])if(map.getLayer(id))map.setLayoutProperty(id,"visibility",visible?"visible":"none");}
  function legacyVisibility() {
    if(!primaryReady)return;
    for(const layer of primary.getStyle().layers) {
      if(layer.id.startsWith("nc-")||layer.id==="osm"||layer.type==="background")continue;
      if(active){if(!savedVisibility.has(layer.id))savedVisibility.set(layer.id,primary.getLayoutProperty(layer.id,"visibility")||"visible");primary.setLayoutProperty(layer.id,"visibility","none");}
      else if(savedVisibility.has(layer.id)){primary.setLayoutProperty(layer.id,"visibility",savedVisibility.get(layer.id));savedVisibility.delete(layer.id);}
    }
  }
  function paint(map,rows,range,mode="values") {
    prepare(map);
    const data={type:"FeatureCollection",features:(packet.geo?.features||[]).map(f=>{
      const value=rows.find(r=>r.ccaa_codigo===f.properties.ccaa_codigo)?.value;
      const missing=!window.ContractCore.present(value);
      return {...f,properties:{...f.properties,nc_missing:missing,nc_value:value??null,nc_color:missing?"#eee9df":window.ContractMaps.color(value,packet.component,range,mode)}};
    })};
    map.getSource("nc-contract").setData(data);
    map.setFilter("nc-selection",["==",["get","ccaa_codigo"],packet.selected||""]);
    map.setPaintProperty("nc-missing","fill-pattern",packet.atlas?"nc-atlas-absent":"nc-absent");
    map.setPaintProperty("nc-outline","line-color",packet.atlas?"#7e826b":"#526c61");
    map.setPaintProperty("nc-selection","line-color",packet.atlas?"#34402b":"#12382c");
    showLayers(map,true);
    for(const id of ["nc-fill","nc-missing","nc-outline","nc-selection"])map.moveLayer(id);
  }
  function legend(range,mode) {
    let items;
    if(mode==="transition")items=[["same","Misma categoría"],["changed","Cambio de categoría"]]
      .map(([value,label])=>({label,color:window.ContractMaps.color(value,packet.component,null,mode)}));
    else if(packet.component==="tendencias") {
      const core=window.ContractCore;
      items=Object.entries(core.trendLabels(packet.trendScheme)).map(([value,label])=>({
        label:`${core.trendIcons[value]} ${label}`,color:window.ContractMaps.color(value,packet.component,null,mode)
      }));
    }
    else if(!range)items=[];
    else {
      const max=Math.max(Math.abs(range[0]),Math.abs(range[1]));
      const values=mode==="difference"?(max?[-max,0,max]:[0]):range[0]===range[1]?[range[0]]:[range[0],(range[0]+range[1])/2,range[1]];
      items=values.map(v=>({label:fmt(v),color:window.ContractMaps.color(v,packet.component,range,mode)}));
    }
    const samples=items.map(x=>`<span><i style="background:${x.color}"></i>${esc(x.label)}</span>`).join("");
    const noData=`<span><i class="nc-map-missing"></i>${mode==="values"?"Sin datos":"Sin pareja de datos"}</span>`;
    if(packet.atlas&&mode==="values"&&range) {
      const title=esc(packet.valueLabel);
      const gradient=range.map(v=>window.ContractMaps.color(v,packet.component,range,mode)).join(",");
      if(range[0]===range[1])return `<strong>${title}</strong><div class="nc-atlas-legend-key">${samples}${noData}</div>`;
      return `<strong>${title}</strong><div class="nc-atlas-ramp" style="background:linear-gradient(90deg,${gradient})" aria-hidden="true"></div><div class="nc-atlas-legend-key"><span>${esc(fmt(range[0]))}</span><span>${esc(fmt(range[1]))}</span></div>${noData}`;
    }
    return samples+noData;
  }
  function ensureSecond() {
    if(secondary)return;
    const style={version:8,sources:{osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"OpenStreetMap contributors"}},layers:[{id:"osm",type:"raster",source:"osm"}]};
    secondary=new maplibregl.Map({container:"ncSecondaryMap",style,center:primary.getCenter(),zoom:primary.getZoom(),bearing:primary.getBearing(),pitch:primary.getPitch()});
    secondary.addControl(new maplibregl.NavigationControl({showCompass:false}),"top-left");
    secondary.on("load",()=>{secondaryReady=true;apply();});
    secondary.on("move",()=>synchronize(secondary,primary));
  }
  function synchronize(from,to) {
    if(syncing||!active||packet?.mode!=="split"||!to)return;
    syncing=true;to.jumpTo({center:from.getCenter(),zoom:from.getZoom(),bearing:from.getBearing(),pitch:from.getPitch()});syncing=false;
  }
  function apply() {
    if(!primaryReady||!packet)return;
    legacyVisibility();
    atlasBasemap(primary,active&&packet.atlas);
    const split=active&&packet.mode==="split";
    document.querySelector(".map-shell").classList.toggle("nc-split-map",split);
    document.getElementById("ncSecondaryMap").hidden=!split;
    document.getElementById("ncMapOverlay").hidden=!active;
    if(!active){showLayers(primary,false);if(secondary)showLayers(secondary,false);primary.resize();return;}
    if(!initialized){initialized=true;primary.fitBounds([[-9.6,35.7],[4.5,43.9]],{padding:{top:100,bottom:90,left:35,right:35},duration:0});}
    if(packet.planning&&split!==planningSplit) {
      planningSplit=split;
      primary.resize();
      primary.fitBounds([[-9.6,35.7],[4.5,43.9]],{padding:{top:40,bottom:30,left:20,right:20},duration:0});
    }
    const range=packet.range,mode=packet.mode==="difference"?(packet.component==="tendencias"?"transition":"difference"):"values";
    paint(primary,packet.mode==="difference"?packet.difference:packet.rows,packet.mode==="difference"?packet.differenceRange:range,mode);
    const title=document.getElementById("ncLiveTitle");
    title.textContent=packet.title;
    title.hidden=packet.atlas&&!packet.planning&&packet.mode==="values";
    document.getElementById("ncLiveLegend").innerHTML=legend(packet.mode==="difference"?packet.differenceRange:range,mode);
    document.getElementById("ncMapLabelA").textContent=split?`A · ${packet.labelA}`:"";
    document.getElementById("ncMapLabelB").textContent=split?`B · ${packet.labelB}`:"";
    if(split){ensureSecond();if(secondaryReady){atlasBasemap(secondary,packet.atlas);paint(secondary,packet.second,range);secondary.resize();synchronize(primary,secondary);}}
    primary.resize();
  }
  function attach(map) {primary=map;primaryReady=map.isStyleLoaded();primary.on("load",()=>{primaryReady=true;apply();});primary.on("move",()=>synchronize(primary,secondary));apply();}
  function update(next){packet=next;active=next.active;apply();}
  function fit(code) {
    if(!primary)return;
    let bounds=[[-9.6,35.7],[4.5,43.9]];
    if(code==="mainland")bounds=[[-9.6,35.7],[4.5,43.9]];
    else if(code){const f=packet.geo?.features.find(f=>f.properties.ccaa_codigo===code);if(f){let a=[];function walk(v){if(typeof v[0]==="number")a.push(v);else v.forEach(walk);}walk(f.geometry.coordinates);bounds=[[Math.min(...a.map(p=>p[0])),Math.min(...a.map(p=>p[1]))],[Math.max(...a.map(p=>p[0])),Math.max(...a.map(p=>p[1]))]];}}
    const padding=packet.planning?{top:40,bottom:30,left:20,right:20}:{top:110,bottom:95,left:35,right:35};
    primary.fitBounds(bounds,{padding,maxZoom:8,duration:400});
  }
  document.getElementById("ncMapTools").addEventListener("click",e=>{const b=e.target.closest("[data-fit]");if(b)fit(b.dataset.fit==="all"?null:b.dataset.fit);});
  return {attach,update,fit,ready:apply};
})();
