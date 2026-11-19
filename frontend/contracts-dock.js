/* Shared resizing for the atlas and national planning results panels. */
window.ContractDock=(()=>{
  const workspace=document.querySelector(".workspace");
  const preferredHeights=new WeakMap();
  let activeRoot=null,drag=null,resizeFrame=0;

  function grip(panelId) {
    return `<div class="nc-dock-grip" role="separator" aria-label="Ajustar altura del panel"
      aria-controls="${panelId}" aria-orientation="horizontal" tabindex="0" title="Arrastra para ajustar la altura"></div>`;
  }

  function toggle(panelId,action) {
    return `<button type="button" class="nc-dock-toggle" ${action} aria-controls="${panelId}"></button>`;
  }

  function limits() {
    const compact=matchMedia("(max-width:580px)").matches;
    const timeline=activeRoot.querySelector(".nc-annual")?.offsetHeight||0;
    const mapMinimum=compact?50:timeline?220:240;
    const maximum=Math.max(128,workspace.clientHeight-mapMinimum-timeline);
    return {minimum:128,maximum};
  }

  function applyHeight() {
    if(!activeRoot||activeRoot.hidden)return;
    const handle=activeRoot.querySelector(".nc-dock-grip");
    if(!handle)return;
    const preferred=preferredHeights.get(activeRoot);
    const {minimum,maximum}=limits();
    if(handle.hidden||preferred==null)workspace.style.removeProperty("--nc-dock-height");
    else workspace.style.setProperty("--nc-dock-height",`${Math.min(maximum,Math.max(minimum,preferred))}px`);
    if(handle.hidden)return;
    const height=Math.round(handle.closest(".nc-dock").getBoundingClientRect().height);
    handle.setAttribute("aria-valuemin",String(minimum));
    handle.setAttribute("aria-valuemax",String(Math.max(height,maximum)));
    handle.setAttribute("aria-valuenow",String(height));
    handle.setAttribute("aria-valuetext",`${height} píxeles`);
  }

  function notifyResize() {
    if(resizeFrame)return;
    resizeFrame=requestAnimationFrame(()=>{
      resizeFrame=0;
      window.dispatchEvent(new Event("resize"));
    });
  }

  function finishDrag() {
    drag=null;
    document.body.classList.remove("nc-dock-dragging");
  }

  function sync(root,collapsed,editing=false) {
    const body=root.querySelector(".nc-dock-body");
    const handle=root.querySelector(".nc-dock-grip");
    const control=root.querySelector(".nc-dock-toggle");
    if(drag&&(activeRoot!==root||drag.handle!==handle||collapsed))finishDrag();
    activeRoot=root;
    body.hidden=handle.hidden=collapsed;
    const label=collapsed?"Mostrar panel":"Minimizar panel";
    control.setAttribute("aria-label",label);
    control.setAttribute("aria-expanded",String(!collapsed));
    control.title=label;
    document.body.classList.toggle("nc-dock-collapsed",collapsed);
    document.body.classList.toggle("nc-dock-expanded",editing&&!collapsed);
    applyHeight();
    notifyResize();
  }

  function resize(value) {
    const {minimum,maximum}=limits();
    preferredHeights.set(activeRoot,Math.round(Math.min(maximum,Math.max(minimum,value))));
    applyHeight();
    notifyResize();
  }

  workspace.addEventListener("pointerdown",event=>{
    const handle=event.target.closest(".nc-dock-grip");
    if(!handle||handle.hidden||!activeRoot?.contains(handle)||event.button!==0||!event.isPrimary)return;
    drag={handle,id:event.pointerId,startY:event.clientY,height:handle.closest(".nc-dock").offsetHeight};
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add("nc-dock-dragging");
    event.preventDefault();
  });
  workspace.addEventListener("pointermove",event=>{
    if(drag?.id===event.pointerId)resize(drag.height+drag.startY-event.clientY);
  });
  for(const eventName of ["pointerup","pointercancel","lostpointercapture"]) {
    workspace.addEventListener(eventName,event=>{if(drag?.id===event.pointerId)finishDrag();});
  }
  workspace.addEventListener("keydown",event=>{
    const handle=event.target.closest(".nc-dock-grip");
    if(!handle||handle.hidden||!activeRoot?.contains(handle))return;
    const {minimum,maximum}=limits();
    const height=handle.closest(".nc-dock").offsetHeight;
    const sizes={ArrowUp:height+24,ArrowDown:height-24,Home:minimum,End:maximum};
    if(!Object.hasOwn(sizes,event.key))return;
    event.preventDefault();
    resize(sizes[event.key]);
  });
  window.addEventListener("resize",applyHeight);

  return {grip,toggle,sync};
})();
