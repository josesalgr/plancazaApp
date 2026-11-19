/* Shared colors for the interactive national-data maps. */
window.ContractMaps=(()=>{
  const colors={
    en_alza:"#397db1",decrecimiento:"#d49136",constante:"#8b80b5",
    aumento_fuerte:"#245d89",aumento_moderado:"#65a3c6",estable:"#879c77",
    incierta:"#9a8eb2",descenso_moderado:"#d89859",descenso_pronunciado:"#a85931",
    same:"#90b7a1",changed:"#7866ad"
  };
  const ramps={abundancias:["e6e9cd","4c633a"],historico_caza:["f2e1c2","905826"],cupos:["e6e9cd","435e3c"]};
  function mix(a,b,t) {const rgb=h=>h.match(/\w\w/g).map(x=>parseInt(x,16));return "#"+rgb(a).map((x,i)=>Math.round(x+(rgb(b)[i]-x)*Math.max(0,Math.min(1,t))).toString(16).padStart(2,"0")).join("");}
  function color(value,component,range,mode) {
    if(mode==="transition")return colors[value];
    if(component==="tendencias")return colors[value];
    if(!range)return "#dbe8e1";
    if(mode==="difference") {const max=Math.max(Math.abs(range[0]),Math.abs(range[1]))||1;return value<0?mix("f5f5f2","b15b38",-value/max):mix("f5f5f2","34799f",value/max);}
    return mix(...ramps[component],range[0]===range[1]?.55:(value-range[0])/(range[1]-range[0]));
  }
  function thumbnail(canvas,geo,rows,component) {
    if(!canvas)return;
    const ctx=canvas.getContext("2d");
    const {width,height}=canvas;
    const core=window.ContractCore;
    const range=core.domain(rows);
    const values=new Map(rows.map(row=>[row.ccaa_codigo,row.value]));
    const scale=Math.min((width-12)/14,(height-12)/(8.4*1.3));
    const center=[-2.6,39.8];
    ctx.fillStyle="#dce8e9";
    ctx.fillRect(0,0,width,height);
    ctx.lineWidth=.65;
    ctx.strokeStyle="#878c77";
    for(const feature of geo.features) {
      const geometry=feature.geometry;
      const polygons=geometry.type==="Polygon"?[geometry.coordinates]:geometry.coordinates;
      ctx.beginPath();
      for(const polygon of polygons) for(const ring of polygon) {
        for(const [i,[lon,lat]] of ring.entries()) {
          const x=width/2+(lon-center[0])*scale,y=height/2-(lat-center[1])*scale*1.3;
          if(i===0)ctx.moveTo(x,y);
          else ctx.lineTo(x,y);
        }
        ctx.closePath();
      }
      const value=values.get(feature.properties.ccaa_codigo);
      ctx.fillStyle=core.present(value)?color(value,component,range,"values"):"#f5f1e6";
      ctx.fill("evenodd");
      ctx.stroke();
    }
  }
  return {color,thumbnail};
})();
