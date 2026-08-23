(function(){
  const base='https://cdn.jsdelivr.net/gh/yashjotani007/strike-pulse-relay@main/public/';
  const version='20260823-layout3';
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
})();
