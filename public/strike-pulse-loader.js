(function(){
  const base='https://cdn.jsdelivr.net/gh/yashjotani007/strike-pulse-relay@main/public/';
  const version='20260824-theme-card-force-03';
  console.log('[StrikePulse] Loader: FORCE loading latest theme assets',version);

  const addCss=(id,file)=>{
    let el=document.querySelector('link[data-'+id+']');
    if(!el){
      el=document.createElement('link');
      el.rel='stylesheet';
      el.dataset[id]='1';
      document.head.appendChild(el);
    }
    el.href=base+file+'?v='+version+'&force='+Date.now();
  };

  const addJs=(id,file)=>{
    if(document.querySelector('script[data-'+id+']')) return;
    const el=document.createElement('script');
    el.src=base+file+'?v='+version+'&force='+Date.now();
    el.defer=true;
    el.dataset[id]='1';
    document.head.appendChild(el);
  };

  addCss('strike-pulse-css','strike-pulse.css');
  addCss('strike-pulse-fix-css','strike-pulse-fix.css');
  addJs('strike-pulse-js','strike-pulse.js');
  addJs('strike-pulse-home-fix','strike-pulse-home-fix.js');
})();
