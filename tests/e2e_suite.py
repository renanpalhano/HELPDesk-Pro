"""
Testes de ponta a ponta do HelpDesk Pro (Playwright + Chromium).

Uso:
    pip install playwright && playwright install chromium
    python tests/e2e_suite.py

Sobe um servidor HTTP local temporário, roda os cenários e sai com código 1
se algum falhar. Variável opcional CHROME_PATH aponta para outro Chromium.
"""
import json, os, subprocess, time, sys
from playwright.sync_api import sync_playwright

ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),".."))
server = subprocess.Popen([sys.executable,"-m","http.server","8766","--directory",ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1.2)
URL="http://localhost:8766/index.html"
CHROME=os.environ.get("CHROME_PATH")  # opcional; padrão = Chromium do Playwright
results=[]
def check(name, cond, extra=""):
    results.append((name, bool(cond), extra))
    print(("PASS " if cond else "FAIL ")+name+(("  -> "+str(extra)) if extra and not cond else ""))

def goto_section(pg, s):
    pg.click(f".nav-item[data-section='{s}']"); pg.wait_for_timeout(150)

def fill_form(pg, title="Impressora parada no setor", desc="A impressora do setor parou de imprimir desde cedo.", requester="Teste QA", dep="Financeiro", cat="Impressão", pri="Alta"):
    pg.fill("#requester",requester); pg.select_option("#department",dep); pg.select_option("#category",cat)
    pg.fill("#title",title); pg.fill("#description",desc); pg.select_option("#priority",pri)

def toast_text(pg): return pg.inner_text("#toastTitle")+" | "+pg.inner_text("#toastMessage")
def wait_toast(pg, text, timeout=9000):
    try:
        pg.wait_for_function("(t)=>document.getElementById('toast').classList.contains('show') && (document.getElementById('toastTitle').textContent+' | '+document.getElementById('toastMessage').textContent).includes(t)", arg=text, timeout=timeout)
        return True
    except Exception:
        return False

try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=["--no-sandbox"]) if CHROME else p.chromium.launch()
    def newpage(w=1280,h=900,ctx=None):
        c=ctx or b.new_context(viewport={"width":w,"height":h})
        pg=c.new_page(); pg.errs=[]
        pg.on("pageerror",lambda e:pg.errs.append(str(e)))
        pg.on("console",lambda m: pg.errs.append(m.text) if m.type=="error" and "403" not in m.text else None)
        return pg
    # ---------- 1. carga limpa
    pg=newpage(); pg.goto(URL); pg.wait_for_timeout(400)
    check("01 carga sem erros JS", not pg.errs, pg.errs)
    check("01 5 exemplos semeados", pg.inner_text("#statTotal")=="5")
    check("01 banner de exemplos visível", not pg.evaluate("document.getElementById('demoBanner').classList.contains('hidden')"))
    check("01 armazenamento ativo", "ativo" in pg.inner_text("#storageStatusTitle"))
    check("01 título da aba PT", pg.title()=="HelpDesk Pro | Gestão de Chamados")
    # ---------- 2. i18n cobertura EN
    pg.evaluate("window.languageManager.setLanguage('en')"); pg.wait_for_timeout(200)
    ptonly=pg.evaluate("""(()=>{function flat(o,p=''){return Object.entries(o).flatMap(([k,v])=>typeof v==='object'?flat(v,p+k+'.'):[[p+k,v]])}
      const pt=Object.fromEntries(flat(i18n.pt)),en=Object.fromEntries(flat(i18n.en));
      return Object.keys(pt).filter(k=>pt[k]!==en[k]&&pt[k].length>3&&!pt[k].includes('{')).map(k=>pt[k]);})()""")
    scan_js="""(ptonly)=>{const bad=[];const seen=new Set();
      const vis=e=>e.getClientRects().length>0;
      const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      while(w.nextNode()){const n=w.currentNode;const el=n.parentElement;if(!el||['SCRIPT','STYLE'].includes(el.tagName)||!vis(el))continue;
        const tx=n.textContent.trim();if(tx&&ptonly.includes(tx)&&!el.closest('.demo-user'))bad.push(tx);}
      document.querySelectorAll('[aria-label],[title],[placeholder]').forEach(el=>{if(!vis(el))return;['aria-label','title','placeholder'].forEach(a=>{const v=el.getAttribute(a);if(v&&ptonly.includes(v))bad.push(a+':'+v)})});
      return [...new Set(bad)];}"""
    check("02 título da aba EN", pg.title()=="HelpDesk Pro | Ticket Management")
    check("02 html lang=en", pg.evaluate("document.documentElement.lang")=="en")
    for sec in ["dashboard","chamados","novo-chamado"]:
        goto_section(pg,sec)
        bad=pg.evaluate(scan_js,ptonly)
        check(f"02 EN sem texto PT em '{sec}'", not bad, bad)
    goto_section(pg,"chamados")
    pg.locator("[data-action='view']").first.click(); pg.wait_for_timeout(150)
    check("02 EN modal sem texto PT", not pg.evaluate(scan_js,ptonly), pg.evaluate(scan_js,ptonly))
    pg.keyboard.press("Escape")
    pg.locator("[data-action='delete']").first.click(); pg.wait_for_timeout(150)
    check("02 EN confirmação sem texto PT", not pg.evaluate(scan_js,ptonly), pg.evaluate(scan_js,ptonly))
    pg.keyboard.press("Escape")
    # edit mode em EN
    pg.locator("[data-action='edit']").first.click(); pg.wait_for_timeout(200)
    check("02 EN modo edição", "editing ticket" in pg.inner_text("#editBanner") and pg.inner_text("#submitTicketButton")=="Save Changes", pg.inner_text("#editBanner"))
    pg.evaluate("window.languageManager.setLanguage('pt')"); pg.wait_for_timeout(200)
    check("02 troca de idioma em edição mantém modo edição PT", "Você está editando" in pg.inner_text("#editBanner"))
    pg.click("#cancelFormButton")
    # ---------- 3. validação do formulário
    goto_section(pg,"novo-chamado")
    pg.click("#submitTicketButton"); pg.wait_for_timeout(150)
    inv=pg.evaluate("[...document.querySelectorAll('[aria-invalid=true]')].map(e=>e.id)")
    check("03 6 campos com aria-invalid", inv==["requester","department","category","title","description","priority"], inv)
    check("03 foco no primeiro inválido", pg.evaluate("document.activeElement.id")=="requester")
    check("03 resumo de erros visível", "6" in pg.inner_text("#formErrorSummary"))
    check("03 aria-describedby liga ao erro", "requesterError" in pg.get_attribute("#requester","aria-describedby"))
    check("03 priority mantém guia no describedby", pg.get_attribute("#priority","aria-describedby")=="priorityHint priorityGuide priorityError", pg.get_attribute("#priority","aria-describedby"))
    pg.fill("#requester","Teste QA"); 
    check("03 erro some ao corrigir", pg.get_attribute("#requester","aria-invalid") is None)
    fill_form(pg,title="aaaaaaa"); pg.click("#submitTicketButton")
    check("03 título 'aaaaaaa' rejeitado", "repetidos" in pg.inner_text("#titleError"), pg.inner_text("#titleError"))
    fill_form(pg,desc="bbbbbbbbbbbb"); pg.click("#submitTicketButton")
    check("03 descrição repetida rejeitada", "repetidos" in pg.inner_text("#descriptionError"), pg.inner_text("#descriptionError"))
    # ---------- 4. criar + número no toast + id não reutilizado
    fill_form(pg); pg.click("#submitTicketButton"); pg.wait_for_timeout(200)
    check("04 toast com número CH-1005", wait_toast(pg,"CH-1005"), toast_text(pg))
    check("04 volta para lista", pg.evaluate("document.getElementById('section-chamados').classList.contains('active')"))
    check("04 contador de resultados", pg.inner_text("#resultsCount")=="6 chamados", pg.inner_text("#resultsCount"))
    # excluir CH-1005 e criar outro
    pg.fill("#searchInput","CH-1005"); pg.wait_for_timeout(350)
    pg.locator("[data-action='delete']").first.click(); pg.click("#confirmDeleteButton"); pg.wait_for_timeout(200)
    pg.fill("#searchInput",""); pg.wait_for_timeout(350)
    goto_section(pg,"novo-chamado"); fill_form(pg,title="Segundo chamado de teste"); pg.click("#submitTicketButton"); pg.wait_for_timeout(200)
    check("04 número NÃO reutilizado (CH-1006)", wait_toast(pg,"CH-1006"), toast_text(pg))
    # ---------- 5. persistência
    pg.reload(); pg.wait_for_timeout(300)
    check("05 persiste após reload (6 chamados)", pg.inner_text("#statTotal")=="6", pg.inner_text("#statTotal"))
    pg.evaluate("window.languageManager.setLanguage('en')"); pg.reload(); pg.wait_for_timeout(300)
    check("05 idioma persiste", pg.evaluate("document.documentElement.lang")=="en")
    pg.evaluate("window.languageManager.setLanguage('pt')")
    # ---------- 6. status: transições, histórico, log
    goto_section(pg,"chamados")
    pg.fill("#searchInput","CH-1006"); pg.wait_for_timeout(350)
    pg.locator("[data-action='view']").first.click(); pg.wait_for_timeout(150)
    opts=pg.evaluate("[...document.querySelectorAll('#modalStatusSelect option')].map(o=>o.value)")
    check("06 Aberto só permite Atendimento/Encerrado", opts==["Aberto","Em atendimento","Encerrado"], opts)
    pg.focus("#modalStatusSelect"); pg.select_option("#modalStatusSelect","Em atendimento"); pg.wait_for_timeout(150)
    opts=pg.evaluate("[...document.querySelectorAll('#modalStatusSelect option')].map(o=>o.value)")
    check("06 após atendimento: Aberto/Resolvido/Encerrado", opts==["Aberto","Em atendimento","Resolvido","Encerrado"], opts)
    check("06 histórico com 2 entradas", pg.locator(".status-history-item").count()==2)
    check("06 foco permanece no select", pg.evaluate("document.activeElement.id")=="modalStatusSelect")
    # transição inválida forçada via API interna: injeta option proibida
    pg.evaluate("""(()=>{const s=document.getElementById('modalStatusSelect');s.value='Em atendimento';})()""")
    pg.keyboard.press("Escape")
    # ---------- 7. edição e log
    pg.locator("[data-action='edit']").first.click(); pg.wait_for_timeout(200)
    check("07 banner de edição", "CH-1006" in pg.inner_text("#editBanner"))
    pg.click("#submitTicketButton"); pg.wait_for_timeout(150)
    check("07 sem alterações → aviso", wait_toast(pg,"Nenhuma alteração"), toast_text(pg))
    pg.wait_for_timeout(4200)
    pg.locator("[data-action='edit']").first.click(); pg.wait_for_timeout(200)
    pg.fill("#title","Título editado do chamado"); pg.click("#submitTicketButton"); pg.wait_for_timeout(200)
    pg.locator("[data-action='view']").first.click(); pg.wait_for_timeout(150)
    check("07 log de alterações no modal", "alterações registradas" in pg.inner_text("#modalContent").lower() and "Título editado" in pg.inner_text("#modalContent"))
    pg.keyboard.press("Escape")
    check("07 título do modal restaurado", pg.inner_text("#modalTitle")=="Detalhes do chamado", pg.inner_text("#modalTitle"))
    pg.fill("#searchInput","")
    # ---------- 8. XSS
    goto_section(pg,"novo-chamado")
    fill_form(pg,title="<img src=x onerror=window.__xss=1>",desc="<script>window.__xss=2</script> texto"); pg.click("#submitTicketButton"); pg.wait_for_timeout(300)
    check("08 XSS não executa", pg.evaluate("window.__xss===undefined"))
    check("08 texto aparece literal", "<img src=x" in pg.inner_text("#ticketsTableBody"))
    # ---------- 9. filtros / dashboard clicável
    goto_section(pg,"dashboard")
    n=pg.inner_text("#statResolved")
    pg.click("[data-stat-filter='concluidos']"); pg.wait_for_timeout(200)
    check("09 cartão leva à lista filtrada", pg.evaluate("document.getElementById('section-chamados').classList.contains('active')") and pg.locator("#ticketsTableBody tr").count()==int(n), (n,pg.locator("#ticketsTableBody tr").count()))
    pg.select_option("#categoryFilter","Rede"); pg.fill("#searchInput","zzz"); pg.wait_for_timeout(350)
    check("09 vazio esconde cabeçalho da tabela", pg.evaluate("document.getElementById('tableWrapper').classList.contains('hidden')"))
    pg.click("#clearFiltersButton"); pg.wait_for_timeout(200)
    check("09 limpar filtros zera categoria", pg.input_value("#categoryFilter")=="todas" and pg.input_value("#statusFilter")=="todos")
    # ---------- 10. exemplos
    pg.click("#removeDemoButton"); pg.wait_for_timeout(200)
    check("10 remover exemplos", wait_toast(pg,"removidos"), toast_text(pg))
    pg.click("#loadDemoButton"); pg.wait_for_timeout(200)
    t1=pg.inner_text("#toastTitle")
    check("10 fila: 1º toast ainda visível", t1=="Exemplos removidos", t1)
    check("10 fila: 2º toast exibido depois", wait_toast(pg,"Exemplos carregados"), pg.inner_text("#toastTitle"))
    ids=pg.evaluate("JSON.parse(localStorage.getItem('helpdesk-pro-tickets')).map(t=>t.id)")
    check("10 ids de exemplos novos não reutilizam", len(ids)==len(set(ids)) and max(ids)>=1011, ids)
    # ---------- 11. excluir tudo -> não ressuscita
    ctx=b.new_context(viewport={"width":1280,"height":900}); pg2=newpage(ctx=ctx); pg2.goto(URL); pg2.wait_for_timeout(300)
    pg2.click("#removeDemoButton"); pg2.wait_for_timeout(200)
    pg2.reload(); pg2.wait_for_timeout(300)
    check("11 após apagar tudo e recarregar: 0 chamados", pg2.inner_text("#statTotal")=="0")
    goto_section(pg2,"chamados")
    check("11 estado vazio próprio + botão Novo chamado", "Nenhum chamado registrado" in pg2.inner_text("#ticketsEmpty") and not pg2.evaluate("document.getElementById('emptyNewButton').classList.contains('hidden')"))
    # ---------- 12. dados corrompidos / inválidos
    ctx=b.new_context(); pg3=newpage(ctx=ctx); pg3.goto(URL); pg3.wait_for_timeout(200)
    pg3.evaluate("localStorage.setItem('helpdesk-pro-tickets','{{quebrado')"); pg3.reload(); pg3.wait_for_timeout(300)
    check("12 corrompido: aviso", wait_toast(pg3,"ilegíveis"), toast_text(pg3))
    check("12 corrompido: backup guardado", pg3.evaluate("localStorage.getItem('helpdesk-pro-backup-corrupted')")=="{{quebrado")
    check("12 corrompido: NÃO semeia exemplos", pg3.inner_text("#statTotal")=="0")
    bad=[{"id":2001,"requester":"A","department":"X","category":"Y","title":"Ok título","description":"descrição válida aqui","priority":"Zzz","status":"Foo","createdAt":"lixo"},
         {"id":2002,"title":"sem requester","description":"x"},
         {"id":2001,"requester":"dup","title":"duplicado","description":"duplicado aqui"},"string",None,{"id":"abc"}]
    pg3.evaluate("(d)=>localStorage.setItem('helpdesk-pro-tickets',JSON.stringify(d))",bad); pg3.reload(); pg3.wait_for_timeout(300)
    check("12 inválidos: só 1 aproveitado", pg3.inner_text("#statTotal")=="1", pg3.inner_text("#statTotal"))
    check("12 inválidos: backup + aviso", pg3.evaluate("JSON.parse(localStorage.getItem('helpdesk-pro-backup-invalid')).length")==5 and wait_toast(pg3,"ignorados"), pg3.evaluate("JSON.parse(localStorage.getItem('helpdesk-pro-backup-invalid')).length"))
    t=pg3.evaluate("JSON.parse(localStorage.getItem('helpdesk-pro-tickets'))[0]")
    check("12 normalização: defaults seguros", t["priority"]=="Média" and t["status"]=="Aberto" and t["department"]=="Outro" and t["category"]=="Sistemas" and t["isDemo"] is False and len(t["statusHistory"])==1, t)
    pg3.evaluate("localStorage.setItem('helpdesk-pro-last-id','5000')"); pg3.reload(); pg3.wait_for_timeout(200)
    goto_section(pg3,"novo-chamado"); fill_form(pg3); pg3.click("#submitTicketButton"); pg3.wait_for_timeout(200)
    check("12 contador persistido respeitado (CH-5001)", wait_toast(pg3,"CH-5001"), toast_text(pg3))
    # ---------- 13. falha ao gravar
    ctx=b.new_context(); pg4=newpage(ctx=ctx); pg4.goto(URL); pg4.wait_for_timeout(300)
    pg4.evaluate("(()=>{const o=Storage.prototype.setItem;window.__fail=true;Storage.prototype.setItem=function(...a){if(window.__fail)throw new DOMException('cheio','QuotaExceededError');return o.apply(this,a)}})()")
    goto_section(pg4,"novo-chamado"); fill_form(pg4); pg4.click("#submitTicketButton"); pg4.wait_for_timeout(250)
    check("13 falha ao gravar: aviso de erro (sem 'criado')", wait_toast(pg4,"Não foi possível salvar") and "criado" not in toast_text(pg4).lower(), toast_text(pg4))
    check("13 status do armazenamento vira erro", "indisponível" in pg4.inner_text("#storageStatusTitle"))
    check("13 sem erro JS não tratado", not pg4.errs, pg4.errs)
    # ---------- 14. erro global
    pg.evaluate("setTimeout(()=>{throw new Error('boom')},0)"); pg.wait_for_timeout(300)
    check("14 erro inesperado vira aviso", wait_toast(pg,"Algo deu errado"), pg.inner_text("#toastTitle"))
    pg.errs.clear()
    # ---------- 15. teclado: skip link, focus trap, backdrop
    ctx=b.new_context(viewport={"width":1280,"height":900}); pg5=newpage(ctx=ctx); pg5.goto(URL); pg5.wait_for_timeout(300)
    pg5.keyboard.press("Tab")
    check("15 1º Tab = skip link", pg5.evaluate("document.activeElement.className")=="skip-link")
    pg5.keyboard.press("Enter"); pg5.wait_for_timeout(100)
    check("15 skip link leva ao conteúdo", pg5.evaluate("document.activeElement.id")=="main-content")
    goto_section(pg5,"chamados")
    btn=pg5.locator("[data-action='view']").first; btn.focus(); btn.press("Enter"); pg5.wait_for_timeout(150)
    seq=[]
    for i in range(5): pg5.keyboard.press("Tab"); seq.append(pg5.evaluate("document.activeElement.id"))
    check("15 focus trap cicla no modal", seq==["closeModalButton","modalStatusSelect","modalCloseFooter","modalEditButton","closeModalButton"], seq)
    check("15 fundo inert", pg5.evaluate("document.querySelector('.app-shell').inert"))
    pg5.mouse.click(5,5); pg5.wait_for_timeout(150)
    check("15 clique no fundo fecha e devolve foco", pg5.evaluate("document.getElementById('ticketModal').classList.contains('hidden')") and pg5.evaluate("document.activeElement.dataset.action")=="view")
    d=pg5.locator("[data-action='delete']").first; d.focus(); d.press("Enter"); pg5.wait_for_timeout(150)
    check("15 confirmação inicia em Cancelar", pg5.evaluate("document.activeElement.id")=="cancelDeleteButton")
    check("15 aviso irreversível", "não poderá ser desfeita" in pg5.inner_text("#confirmMessage"))
    pg5.keyboard.press("Escape")
    # ---------- 16. responsivo
    ctx=b.new_context(); pgr=newpage(ctx=ctx)
    pgr.set_viewport_size({"width":1280,"height":900}); pgr.goto(URL); pgr.wait_for_timeout(300)
    for w in [320,360,375,414,600,768,900,901,1024,1180,1181,1280,1440]:
        pgr.set_viewport_size({"width":w,"height":800}); pgr.wait_for_timeout(120)
        for sec in ["dashboard","chamados","novo-chamado"]:
            pgr.evaluate(f"document.querySelector('.nav-item[data-section=\"{sec}\"]')?.click()") if w>900 else pgr.evaluate(f"(()=>{{document.getElementById('sidebar').removeAttribute('inert');document.querySelector('.nav-item[data-section=\"{sec}\"]').click()}})()")
            pgr.wait_for_timeout(80)
            over=pgr.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
            if over>0: check(f"16 sem rolagem horizontal {w}px/{sec}", False, over)
    check("16 sem rolagem horizontal em 13 larguras x 3 telas", not any((n.startswith("FAIL")) for n in []) and all(r[1] for r in results if r[0].startswith("16 sem")))
    pgr.set_viewport_size({"width":768,"height":800}); pgr.wait_for_timeout(150)
    check("16 drawer: sidebar inert fechada", pgr.evaluate("document.getElementById('sidebar').inert"))
    pgr.click("#mobileMenuButton"); pgr.wait_for_timeout(150)
    check("16 drawer aberto: foco no 1º item", pgr.evaluate("document.activeElement.classList.contains('nav-item')") and not pgr.evaluate("document.getElementById('sidebar').inert"))
    pgr.keyboard.press("Escape"); pgr.wait_for_timeout(100)
    check("16 Esc fecha drawer e devolve foco", pgr.evaluate("document.activeElement.id")=="mobileMenuButton")
    check("16 cartões em 768px", pgr.evaluate("(()=>{document.querySelector('.nav-item[data-section=chamados]');return true})()"))
    pgr.close()
    # ---------- 17. contraste e fonte mínima (todas as telas)
    CONTRAST_JS="""()=>{
      function parse(c){const m=c.match(/rgba?\\(([^)]+)\\)/);if(!m)return null;const p=m[1].split(',').map(x=>parseFloat(x));return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}}
      function lum(c){const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)}
      function bgOf(el){let e=el;while(e){const c=parse(getComputedStyle(e).backgroundColor);if(c&&c.a>0.5)return c;e=e.parentElement}return {r:255,g:255,b:255,a:1}}
      const out=[];const seen=new Set();
      document.querySelectorAll('body *').forEach(el=>{
        if(!el.getClientRects().length)return; if(['SCRIPT','STYLE','svg','path'].includes(el.tagName))return;
        const own=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
        if(!own)return;
        const cs=getComputedStyle(el); const fg=parse(cs.color); const bg=bgOf(el);
        if(!fg)return; const l1=lum(fg),l2=lum(bg); const ratio=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
        const size=parseFloat(cs.fontSize); const bold=parseInt(cs.fontWeight)>=700;
        const large=size>=24||(size>=18.66&&bold);
        const key=el.className+'|'+cs.color+'|'+cs.backgroundColor+'|'+size;
        if(seen.has(key))return; seen.add(key);
        if(ratio<(large?3:4.5)||size<12) out.push({cls:el.className||el.tagName,txt:el.textContent.trim().slice(0,30),ratio:+ratio.toFixed(2),size});
      });return out;}"""
    ctx=b.new_context(viewport={"width":1280,"height":900}); pgc=newpage(ctx=ctx); pgc.goto(URL); pgc.wait_for_timeout(300)
    fails=[]
    for sec in ["dashboard","chamados","novo-chamado"]:
        goto_section(pgc,sec); f=pgc.evaluate(CONTRAST_JS); fails+= [(sec,x) for x in f]
    goto_section(pgc,"chamados"); pgc.locator("[data-action='view']").first.click(); pgc.wait_for_timeout(150)
    fails+=[("modal",x) for x in pgc.evaluate(CONTRAST_JS)]
    check("17 contraste AA e fonte >=12px (dashboard/lista/form/modal)", not fails, fails[:8])
    # ---------- 18. reduced motion
    ctx=b.new_context(reduced_motion="reduce"); pgm=newpage(ctx=ctx); pgm.goto(URL); pgm.wait_for_timeout(200)
    check("18 reduced-motion: scroll-behavior auto", pgm.evaluate("getComputedStyle(document.documentElement).scrollBehavior")=="auto")
    # ---------- 19. erros JS totais
    check("19 nenhuma exceção JS na suíte principal", not [e for e in pg.errs if "boom" not in e], pg.errs)
    b.close()
finally:
    server.terminate()
fails=[r for r in results if not r[1]]
print(f"\nTOTAL {len(results)} | PASS {len(results)-len(fails)} | FAIL {len(fails)}")
sys.exit(1 if fails else 0)
