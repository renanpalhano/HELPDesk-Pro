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
 // Decorative motion only: content stays available if motion is disabled.
 const targets=document.querySelectorAll('.hero>div,.hero>aside,.how-section .card,#welcome .help,#welcome>section:last-child');
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 if(!reduced.matches && 'IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
   entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('tech-visible');observer.unobserve(entry.target);}});
  },{threshold:.12});
  targets.forEach((element,index)=>{element.classList.add('tech-reveal');element.style.setProperty('--reveal-delay',`${Math.min(index%3,2)*80}ms`);observer.observe(element);});
  reduced.addEventListener('change',event=>{if(event.matches){observer.disconnect();targets.forEach(element=>element.classList.add('tech-visible'));}});
 }
});
})();
