// Only run on an isolated catalog (see CHANGELOG).
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  page.setDefaultTimeout(12000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const base=process.env.TEST_URL||'http://127.0.0.1:8081',suffix=Date.now(),fixtures={};
  async function mutate(action,extra) {
    const db=(await (await page.request.get(base+'/api/national-data')).json()).catalog;
    const r=await page.request.post(base+'/api/national-data',{data:{action,revision:db.revision,reason:'QA cartografía',...extra}});
    assert.equal(r.status(),200,await r.text());return (await r.json()).catalog;
  }
  for(const component of ['abundancias','tendencias','historico_caza']) {
    const db=await mutate('series',{series:{component,name:`Mapas ${component} ${suffix}`,definition:'Valores ficticios comparables',source:'QA aislado',unit:component==='tendencias'?'Criterio externo':'Unidad de prueba',interval_type:'Anual'}});
    const s=db.series.at(-1);fixtures[component]={series:s.id,intervals:[]};
    const years=component==='historico_caza'?[2024,2026]:[2024,2025];
    for(const [i,year] of years.entries()) {
      const d=await mutate('interval',{interval:{series_id:s.id,name:`Datos ${year}`,start:`${year}-01-01`,end:`${year}-12-31`}});
      const v=d.intervals.at(-1);fixtures[component].intervals.push(v.id);
      const values=component==='tendencias'?(i?['constante','decrecimiento','en_alza','decrecimiento']:['en_alza','constante',null,'decrecimiento']):(i?[10,0,5,20]:[0,10,null,20]);
      await mutate('records',{interval_id:v.id,rows:values.map((value,j)=>({ccaa_codigo:String(j+1).padStart(2,'0'),value,observations:`Dato ${year}`}))});
    }
  }
  await page.goto(base);
  assert.equal(await page.getByRole('button',{name:'Descargar respaldo',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Actualizar',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Ver cartografía',exact:true}).count(),0);
  const geometry=await (await page.request.get(base+'/api/national-data/geometry')).json();
  assert.equal(geometry.features.length,16);
  assert.equal(new Set(geometry.features.map(f=>f.properties.ccaa_codigo)).size,16);
  assert.ok(geometry.features.every(f=>!('abundance_index' in f.properties)));

  await page.waitForFunction(()=>map.getSource('nc-contract')?._data?.features.length===16);
  assert.equal(await page.locator('.nc-atlas-maps > summary').innerText(),'3 mapas');
  await page.evaluate(()=>window.originalCanvas=map.getCanvas());
  const props=code=>page.evaluate(code=>map.getSource('nc-contract')._data.features.find(f=>f.properties.ccaa_codigo===code).properties,code);
  for(const component of Object.keys(fixtures)) {
    const f=fixtures[component];
    await page.locator(`[data-key="${component}"]`).click();
    const picker=page.locator('#ncSeriesPicker summary');
    if(await picker.count()) {
      await picker.click();
      const option=page.locator(`[data-nc="series"][data-id="${f.series}"]`);
      assert.match(await option.innerText(),/QA aislado/);
      await option.click();
    } else await page.locator('#ncSeries').selectOption(f.series);
    if(component==='historico_caza')await page.locator('[data-year="2026"]').click();
    else await page.locator('#ncInterval').selectOption(f.intervals[1]);
    assert.ok(await page.getByRole('img',{name:/Ilustración de una tórtola/}).isVisible());
    assert.equal((await props('06')).nc_missing,true);
    if(component!=='tendencias')assert.equal((await props('02')).nc_value,0);
    await page.locator('[data-fit=mainland]').click();await page.waitForTimeout(600);
    const point=await page.evaluate(()=>{const p=map.project([-4.5,37.2]);const b=map.getCanvas().getBoundingClientRect();return{x:b.x+p.x,y:b.y+p.y};});
    await page.mouse.click(point.x,point.y);
    await page.waitForFunction(()=>document.querySelector('#ncMapCommunity').value==='01');
    if(component==='abundancias') {
      const chart=page.locator('.nc-atlas-chart');
      assert.equal(await chart.locator('.nc-bar-row').count(),2);
      assert.match(await chart.locator('.nc-bar-active').innerText(),/10/);
      assert.equal(await chart.locator('.nc-bar-zero').count(),1);
    }
    if(component==='tendencias') {
      const history=page.locator('.nc-trend-history');
      assert.match(await history.innerText(),/En alza/);
      assert.match(await history.locator('.nc-bar-active').innerText(),/Constante/);
    }
    if(component==='historico_caza') {
      await page.locator('[data-year="2025"]').click();
      const chart=page.locator('.nc-atlas-chart');
      assert.match(await chart.locator('.nc-bar-active').innerText(),/2025\s+Sin datos/);
      assert.equal((await props('01')).nc_missing,true);
      assert.match(await page.locator('.nc-annual-heading').innerText(),/0 de 16/);
      await page.locator('[data-year="2026"]').click();
    }
    assert.equal(await page.locator('.nc-dock tr[data-code]').count(),1);
    await page.locator('[data-nc=clear-selection]').click();
    await page.locator('[data-tab=compare]').click();
    await page.locator('#ncSecondaryMap canvas').waitFor();await page.waitForTimeout(800);
    const shell=await page.locator('.map-shell').boundingBox(), left=await page.locator('#map').boundingBox();
    assert.ok(Math.abs(shell.x-left.x)<1,'split map stays inside its workspace');
    assert.equal(await page.locator('#ncCompareA option').count(),2);
    assert.match(await page.locator('tr[data-compare-code="03"]').innerText(),/Sin pareja de datos/);
    const colorA=(await props('02')).nc_color;
    await page.locator('[data-nc=swap]').click();
    if(component!=='tendencias')assert.equal((await props('01')).nc_color,colorA);
    await page.locator('[data-nc=swap]').click();
    await page.locator('[data-nc=compare-difference]').click();
    assert.equal((await props('03')).nc_missing,true);
    assert.equal((await props('01')).nc_value,component==='tendencias'?'changed':10);
    assert.equal((await props('04')).nc_value,component==='tendencias'?'same':0);
    await page.locator('[data-nc=compare-split]').click();
    const z=await page.evaluate(()=>map.getZoom());
    await page.locator('#ncSecondaryMap .maplibregl-ctrl-zoom-in').click();await page.waitForTimeout(700);
    assert.ok((await page.evaluate(()=>map.getZoom()))>z+.5);
    assert.equal(await page.evaluate(()=>map.getCanvas()===window.originalCanvas),true);
    await page.screenshot({path:process.env.QA_DIR+`/live-compare-${component}.png`});
    await page.locator('[data-tab=data]').click();
    if(component==='historico_caza')await page.locator('[data-year="2024"]').click();
    else await page.locator('#ncInterval').selectOption(f.intervals[0]);
  }
  const f=fixtures.historico_caza;
  await page.locator('[data-nc=manage-series]').click();
  await page.locator('[data-nc=edit]').first().click();
  await page.locator('tr[data-code="01"] [data-value]').fill('88');
  await page.locator('#ncMapCommunity').selectOption('02');
  assert.equal(await page.locator('tr[data-code="01"] [data-value]').inputValue(),'88');
  await mutate('records',{interval_id:f.intervals[0],rows:[{ccaa_codigo:'02',value:55,observations:'Cambio externo'}]});
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByText('Hay una nueva revisión disponible.',{exact:false}).waitFor();
  assert.equal(await page.locator('tr[data-code="01"] [data-value]').inputValue(),'88');
  await page.locator('[data-nc=cancel-edit]').click();
  await page.getByText('Se han recibido los últimos datos de la serie.',{exact:true}).waitFor();
  assert.match(await page.locator('tr[data-code="02"]').innerText(),/55/);
  await page.locator('[data-section=national]').click();
  assert.equal(await page.evaluate(()=>map.getLayoutProperty('nc-fill','visibility')),'none');
  await page.locator('[data-section=input]').click();
  assert.equal(await page.evaluate(()=>map.getLayoutProperty('nc-fill','visibility')),'visible');
  assert.equal(await page.evaluate(()=>map.getCanvas()===window.originalCanvas),true);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:process.env.QA_DIR+'/live-mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  await browser.close();console.log('Interactive map checks passed.');
})().catch(e=>{console.error(e);process.exit(1)});
