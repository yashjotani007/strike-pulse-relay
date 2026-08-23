(function(){
  const base='https://cdn.jsdelivr.net/gh/yashjotani007/strike-pulse-relay@main/public/';
  if(!document.querySelector('link[data-strike-pulse-css]')){
    const css=document.createElement('link');
    css.rel='stylesheet';
    css.href=base+'strike-pulse.css';
    css.dataset.strikePulseCss='1';
    document.head.appendChild(css);
  }
  if(!document.querySelector('script[data-strike-pulse-js]')){
    const js=document.createElement('script');
    js.src=base+'strike-pulse.js';
    js.defer=true;
    js.dataset.strikePulseJs='1';
    document.head.appendChild(js);
  }
})();
