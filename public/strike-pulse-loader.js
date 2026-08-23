(function(){
  const base='https://cdn.jsdelivr.net/gh/yashjotani007/strike-pulse-relay@main/public/';
  const version='20260824-theme-card-fix-02';
  console.log('[StrikePulse] Loader: refreshing assets',version);
  if(!document.querySelector('link[data-strike-pulse-css]')){
    const css=document.createElement('link');
    css.rel='stylesheet';
    css.href=base+'strike-pulse.css?v='+version;
    css.dataset.strikePulseCss='1';
    document.head.appendChild(css);
  }
  if(!document.querySelector('link[data-strike-pulse-fix-css]')){
    const fix=document.createElement('link');
    fix.rel='stylesheet';
    fix.href=base+'strike-pulse-fix.css?v='+version;
    fix.dataset.strikePulseFixCss='1';
    document.head.appendChild(fix);
  }
  if(!document.querySelector('script[data-strike-pulse-js]')){
    const js=document.createElement('script');
    js.src=base+'strike-pulse.js?v='+version;
    js.defer=true;
    js.dataset.strikePulseJs='1';
    document.head.appendChild(js);
  }
  if(!document.querySelector('script[data-strike-pulse-home-fix]')){
    const fix=document.createElement('script');
    fix.src=base+'strike-pulse-home-fix.js?v='+version;
    fix.defer=true;
    fix.dataset.strikePulseHomeFix='1';
    document.head.appendChild(fix);
  }
})();
