(function(){
"use strict";
let mode=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
try{const saved=localStorage.getItem('helpdesk-theme');if(['light','dark'].includes(saved))mode=saved;}catch{/* Optional preference. */}
document.documentElement.dataset.theme=mode;
function favicon(){const icon=document.getElementById('themeFavicon');if(icon)icon.href=icon.dataset[mode];}
favicon();
window.addEventListener('DOMContentLoaded',()=>{
 const button=document.getElementById('themeToggle');
 function render(){favicon();const pt=document.documentElement.lang.startsWith('pt');button.textContent=mode==='dark'?(pt?'☀ Claro':'☀ Light'):(pt?'☾ Escuro':'☾ Dark');button.setAttribute('aria-label',pt?'Alternar tema claro ou escuro':'Toggle light or dark theme');button.setAttribute('aria-pressed',String(mode==='dark'));}
 button.onclick=()=>{mode=mode==='dark'?'light':'dark';document.documentElement.dataset.theme=mode;try{localStorage.setItem('helpdesk-theme',mode);}catch{/* Optional preference. */}render();};
 new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});render();
});
})();
