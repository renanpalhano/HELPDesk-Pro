(function(){
"use strict";
const $=id=>document.getElementById(id), C=window.HelpDeskCopy,D=window.HelpDeskDomain;
const t=key=>C.t(key), esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
let client,profile=null,tickets=[],profiles=[],departments=[],page=0,current=null,version=0,authVersion=0,lastUser=null,loading=false;
const ticketFields="id,ticket_number,title,description,priority,status,category,requester_id,requester_name,requester_email,department_id,assigned_to,deleted_at,created_at,updated_at";
const date=value=>value?new Intl.DateTimeFormat(C.get()==="pt"?"pt-BR":"en",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)):"—";
function errorText(error){
 const message=error?.message||"";
 if(message==="stale")return t("stale");
 if(message==="validation")return t("validation");
 if(error?.code==="42501" || /permission|row.level|not authorized/i.test(message))return t("permission");
 if(/Invalid login credentials/i.test(message))return t("credentials");
 if(/Email not confirmed/i.test(message))return t("emailUnconfirmed");
 if(/rate limit/i.test(message))return t("rateLimit");
 if(/fetch|network|Failed to/i.test(message))return t("network");
 return t("generic");
}
function notice(message,error=false){$("message").textContent=message;$("message").className="message"+(error?" error":"");$("message").hidden=!message;}
function view(name){for(const id of ["welcome","auth","workspace","detail","reset","recover"])$(id).hidden=id!==name;$("enter").hidden=!!profile||window.HelpDeskRecovery.active();$("logout").hidden=!profile;$("identity").hidden=!profile;$("main").focus();}
function translate(){window.HelpDeskRecovery.refresh();window.HelpDeskGoogle.refresh();document.documentElement.lang=C.get()==="pt"?"pt-BR":"en";$("language").value=C.get();document.querySelectorAll("[data-copy]").forEach(el=>{el.textContent=t(el.dataset.copy);});$("search").placeholder=t("search");if(profile){identity();renderFilters();renderTickets();renderPeople();if(current)renderDetail(current);}}
function identity(){window.HelpDeskAvatar?.refresh(client,profile.id);$("identity").textContent=profile.full_name+" · "+t(profile.role);$("workspaceTitle").textContent=t(profile.role==="requester"?"myTickets":profile.role==="admin"?"management":"queue");}
function options(values,selected=""){return values.map(v=>`<option value="${esc(v)}" ${v===selected?"selected":""}>${esc(C.domain(v))}</option>`).join("");}
function renderFilters(){const status=$("statusFilter").value,scope=$("scope").value;$("statusFilter").innerHTML=`<option value="">${t("all")}</option>`+options(Object.keys(D.transitions),status);$("scope").hidden=profile.role==="requester";$("scope").innerHTML=["all","mine","unassigned",...(profile.role==="admin"?["deleted"]:[])].map(v=>`<option value="${v}" ${v===scope?"selected":""}>${t(v)}</option>`).join("");}
async function allRows(table,fields){const rows=[];for(let start=0;;start+=500){const {data,error}=await client.from(table).select(fields).order("id").range(start,start+499);if(error)throw error;rows.push(...data);if(data.length<500)return rows;}}
async function loadDirectory(){const stamp=version;const results=await Promise.allSettled([allRows("profiles","id,full_name,email,role,department_id,is_active"),allRows("departments","id,name")]);if(stamp!==version)return;profiles=results[0].status==="fulfilled"?results[0].value:[profile];departments=results[1].status==="fulfilled"?results[1].value:[];if(results[0].status==="rejected")notice(t("requestersUnavailable"),true);if(results[1].status==="rejected")notice(t("departmentsUnavailable"),true);renderPeople();}
async function loadTickets(){
 if(!profile || loading)return;loading=true;const stamp=version;$("refresh").disabled=true;$("scope").disabled=true;$("previous").disabled=true;$("next").disabled=true;$("loadState").textContent=t("loading");$("tickets").replaceChildren();
 try{let query=client.from("tickets").select(ticketFields).order("created_at",{ascending:false}).order("id",{ascending:false}).range(page*50,page*50+49);
 if(profile.role==="requester")query=query.eq("requester_id",profile.id);
 query=$("scope").value==="deleted"?query.not("deleted_at","is",null):query.is("deleted_at",null);
 const {data,error}=await query;if(error)throw error;if(stamp!==version)return;tickets=data;renderTickets();$("loadState").textContent=t("resultLimit");
 }catch(error){if(stamp===version){tickets=[];renderTickets();notice(errorText(error),true);$("loadState").textContent="";}}
 finally{if(stamp===version){loading=false;$("refresh").disabled=false;$("scope").disabled=false;}}
}
function renderTickets(){if(!profile)return;const counts=[tickets.length,...["Aberto","Em atendimento","Resolvido"].map(s=>tickets.filter(x=>x.status===s).length)];$("stats").innerHTML=["total","open","working","resolved"].map((key,i)=>`<div class="card"><span>${t(key)}</span><strong>${counts[i]}</strong></div>`).join("");
 const q=$("search").value.toLocaleLowerCase(),status=$("statusFilter").value,scope=$("scope").value;
 const filtered=tickets.filter(x=>(!status||x.status===status)&&(!q||x.title.toLocaleLowerCase().includes(q)||String(x.ticket_number).includes(q))&&(scope!=="mine"||x.assigned_to===profile.id)&&(scope!=="unassigned"||!x.assigned_to));
 $("tickets").innerHTML=filtered.length?filtered.map(x=>`<article class="ticket"><div><small>CH-${esc(x.ticket_number)} · ${esc(date(x.created_at))}</small><h3>${esc(x.title)}</h3><span class="badge status-badge" data-status="${esc(x.status)}">${esc(C.domain(x.status))}</span><span class="badge">${esc(C.domain(x.priority))}</span><small>${esc(x.requester_name||t("requester"))}</small></div><button class="secondary" data-detail="${esc(x.id)}">${t("details")}</button></article>`).join(""):`<p class="card">${t("empty")}</p>`;
 $("page").textContent=t("page")+" "+(page+1);$("previous").disabled=page===0;$("next").disabled=tickets.length<50;
}
function renderPeople(){if(!profile)return;$("people").hidden=profile.role!=="admin";if(profile.role!=="admin")return;$("people").innerHTML=`<h2>${t("people")}</h2><p>${t("peopleHint")}</p>`+profiles.map(p=>`<p><strong>${esc(p.full_name)}</strong> · ${esc(t(p.role))} · ${esc(t(p.is_active?"userActive":"userInactive"))} ${p.role!=="admin"&&p.id!==profile.id?`<button type="button" class="secondary" data-manage-user="${esc(p.id)}">${t("manageUser")}</button>`:""}</p>`).join("");$("people").querySelectorAll("[data-manage-user]").forEach(button=>{button.onclick=()=>openUserManagement(profiles.find(p=>p.id===button.dataset.manageUser));});}
function openUserManagement(person){
 if(!person||profile?.role!=="admin"||person.role==="admin"||person.id===profile.id)return;
 const dialog=document.createElement("dialog"),stamp=version;
 dialog.innerHTML=`<h2>${t("manageUser")}</h2><p><strong>${esc(person.full_name)}</strong><br>${esc(person.email)}</p><p>${t("manageUserHint")}</p><form><div class="field"><label for="managedRole">${t("userRole")}</label><select id="managedRole">${["requester","technician"].map(role=>`<option value="${role}" ${person.role===role?"selected":""}>${t(role)}</option>`).join("")}</select></div><div class="field"><label for="managedActive">${t("userAccess")}</label><select id="managedActive"><option value="true" ${person.is_active?"selected":""}>${t("userActive")}</option><option value="false" ${!person.is_active?"selected":""}>${t("userInactive")}</option></select></div><p role="alert" data-user-error></p><div class="actions"><button type="submit">${t("save")}</button><button type="button" class="secondary" data-cancel>${t("cancel")}</button></div></form>`;
 document.body.append(dialog);dialog.onclose=()=>dialog.remove();dialog.querySelector("[data-cancel]").onclick=()=>dialog.close();
 dialog.querySelector("form").onsubmit=async event=>{
  event.preventDefault();const buttons=dialog.querySelectorAll("button"),errorBox=dialog.querySelector("[data-user-error]");buttons.forEach(b=>b.disabled=true);errorBox.textContent="";
  const controller=new AbortController();let timer;
  try{const request=client.rpc("helpdesk_manage_user",{p_user_id:person.id,p_role:dialog.querySelector("#managedRole").value,p_is_active:dialog.querySelector("#managedActive").value==="true",p_expected_role:person.role,p_expected_active:person.is_active}).abortSignal(controller.signal);const timeout=new Promise((_,reject)=>{timer=window.setTimeout(()=>{controller.abort();reject(new Error("user_save_timeout"));},15000);});const {error}=await Promise.race([request,timeout]);if(error)throw error;if(stamp!==version)return;dialog.close();await loadDirectory();notice(t("saved"));}
  catch(error){if(stamp===version)errorBox.textContent=controller.signal.aborted?t("userSaveTimeout"):/staff_password_required/.test(error.message||"")?t("userPasswordRequired"):/approval_required/.test(error.message||"")?t("userApprovalRequired"):error.code==="PGRST202"?t("userSetupRequired"):errorText(error);}
  finally{window.clearTimeout(timer);buttons.forEach(b=>b.disabled=false);}
 };dialog.showModal();
}
function assigneeName(id){return profiles.find(p=>p.id===id)?.full_name||id||t("none");}
function renderDetail(x){
 const staff=profile.role!=="requester",admin=profile.role==="admin",canAssign=D.canAssign(profile,x);
 $("detail").innerHTML=`<button class="secondary" id="detailBack">← ${t("back")}</button><article class="card" style="margin-top:20px"><span class="eyebrow">CH-${esc(x.ticket_number)}</span><h2>${esc(x.title)}</h2><p class="detail-text">${esc(x.description)}</p><span class="badge status-badge" data-status="${esc(x.status)}">${esc(C.domain(x.status))}</span><span class="badge">${esc(C.domain(x.priority))}</span><span class="badge">${esc(C.domain(x.category))}</span><p>${t("requester")}: ${esc(x.requester_name||assigneeName(x.requester_id))}<br>${t("assignee")}: ${esc(assigneeName(x.assigned_to))}<br>${t("department")}: ${esc(departments.find(d=>d.id===x.department_id)?.name||"—")}</p><small>${t("createdAt")}: ${esc(date(x.created_at))} · ${t("updatedAt")}: ${esc(date(x.updated_at))}</small></article>
 ${staff&&!x.deleted_at?`<form id="editForm" class="card">${admin?`<div class="field"><label for="editTitle">${t("title")}</label><input id="editTitle" value="${esc(x.title)}" required minlength="5" maxlength="120"></div><div class="field"><label for="editDescription">${t("description")}</label><textarea id="editDescription" required minlength="10" maxlength="1000">${esc(x.description)}</textarea></div>`:""}<div class="grid"><div class="field"><label for="editStatus">Status</label><select id="editStatus">${options([x.status,...D.transitions[x.status]],x.status)}</select></div><div class="field"><label for="editPriority">${t("priority")}</label><select id="editPriority">${options(D.priorities,x.priority)}</select></div><div class="field"><label for="editCategory">${t("category")}</label><select id="editCategory">${options(D.categories,x.category)}</select></div></div>${admin?`<p class="muted">${t("adminLimits")}</p>${departments.length?`<div class="field"><label for="editDepartment">${t("department")}</label><select id="editDepartment"><option value="">—</option>${departments.map(d=>`<option value="${d.id}" ${d.id===x.department_id?"selected":""}>${esc(d.name)}</option>`).join("")}</select></div>`:""}<div class="field"><label for="editAssignee">${t("assignee")}</label><select id="editAssignee"><option value="">${t("none")}</option>${profiles.filter(p=>p.is_active&&["technician","admin"].includes(p.role)).map(p=>`<option value="${esc(p.id)}" ${p.id===x.assigned_to?"selected":""}>${esc(p.full_name)}</option>`).join("")}${x.assigned_to&&!profiles.some(p=>p.id===x.assigned_to&&p.is_active&&["technician","admin"].includes(p.role))?`<option value="${esc(x.assigned_to)}" selected>${esc(assigneeName(x.assigned_to))}</option>`:""}</select></div>`:""}<div class="actions"><button type="submit">${t("save")}</button>${!admin&&canAssign?`<button type="button" class="secondary" id="assign">${t(x.assigned_to?"release":"assign")}</button>`:""}${admin?`<button type="button" class="danger" id="trash">${t("delete")}</button>`:""}</div></form>`:""}
 ${admin&&x.deleted_at?`<button id="restore">${t("restore")}</button>`:""}<section class="card"><h2>${t("history")}</h2><div id="history">${t("loading")}</div></section>${admin?`<section class="card"><h2>${t("audit")}</h2><div id="audit">${t("loading")}</div></section>`:""}<section class="card"><h2>${t("comments")}</h2><div id="comments">${t("loading")}</div>${!x.deleted_at?`<form id="commentForm"><div class="field"><label for="commentContent">${t("commentLabel")}</label><textarea id="commentContent" required minlength="1" maxlength="2000"></textarea><small>${t("commentHint")}</small></div><p id="commentError" role="alert"></p><button type="submit">${t("sendComment")}</button></form>`:""}</section>`;
 $("detailBack").onclick=()=>{current=null;view("workspace");loadTickets();};
 if($("editForm"))$("editForm").onsubmit=event=>{event.preventDefault();const patch={};for(const [field,id] of [["department_id","editDepartment"],["status","editStatus"],["priority","editPriority"],["category","editCategory"],["title","editTitle"],["description","editDescription"],["assigned_to","editAssignee"]]){if($(id)){const raw=$(id).value.trim();const value=field==="department_id"?(raw?Number(raw):null):(raw||null);if(value!==x[field])patch[field]=value;}}if(Object.keys(patch).length)updateTicket(x,patch,event.submitter,true);else{current=null;view("workspace");notice(t("saved"));loadTickets();}};
 if($("assign"))$("assign").onclick=event=>updateTicket(x,{assigned_to:x.assigned_to?null:profile.id},event.target);
 if($("trash"))$("trash").onclick=()=>confirmTrash(x);
 if($("restore"))$("restore").onclick=event=>updateTicket(x,{deleted_at:null},event.target);
 loadLogs(x);loadComments(x);if($("commentForm"))$("commentForm").onsubmit=event=>sendComment(event,x);
}
async function loadLogs(x){const stamp=version;const results=await Promise.allSettled([client.from("ticket_status_history").select("old_status,new_status,changed_by").eq("ticket_id",x.id),...(profile.role==="admin"?[client.from("ticket_audit_log").select("user_id,action,field_name,old_value,new_value").eq("ticket_id",x.id)]:[])]);if(stamp!==version||current?.id!==x.id)return;
 for(let i=0;i<results.length;i++){const r=results[i],el=$(i===0?"history":"audit");if(!el)continue;if(r.status==="rejected"||r.value.error){el.textContent=t("optionalUnavailable");continue;}const rows=r.value.data;el.innerHTML=rows.length?rows.map(row=>i===0?`<p>${esc(row.old_status?C.domain(row.old_status):"—")} → ${esc(C.domain(row.new_status))}</p>`:`<p>${esc(row.action)} ${esc(row.field_name||"")} ${esc(row.old_value||"")} → ${esc(row.new_value||"")}</p>`).join(""):"—";}
}
async function loadComments(x){const stamp=version;try{const {data,error}=await client.from("ticket_comments").select("id,ticket_id,author_id,author_name,content,created_at").eq("ticket_id",x.id).order("created_at",{ascending:true}).order("id",{ascending:true});if(error)throw error;if(stamp!==version||current?.id!==x.id)return;$("comments").innerHTML=data.length?data.map(row=>`<article><strong>${esc(profiles.find(p=>p.id===row.author_id)?.full_name||row.author_name||t("requester"))}</strong> <small>${esc(date(row.created_at))}</small><p class="detail-text">${esc(row.content)}</p></article>`).join(""):`<p class="muted">${t("noComments")}</p>`;}catch{if(stamp===version&&current?.id===x.id)$("comments").textContent=t("commentsUnavailable");}}
async function sendComment(event,x){event.preventDefault();const content=$("commentContent").value.trim();if(content.length<1||content.length>2000){$("commentError").textContent=t("commentValidation");return;}const stamp=version,button=event.submitter;button.disabled=true;$("commentError").textContent="";try{const {error}=await client.from("ticket_comments").insert({ticket_id:x.id,author_id:profile.id,content});if(error)throw error;if(stamp!==version||current?.id!==x.id)return;$("commentContent").value="";notice(t("commentSent"));await loadComments(x);}catch(error){if(stamp===version&&current?.id===x.id)$("commentError").textContent=errorText(error);}finally{if(button.isConnected)button.disabled=false;}}
async function updateTicket(x,patch,button,returnToList=false){const stamp=version;button.disabled=true;const form=button.closest("form");if(form)form.querySelectorAll("button").forEach(b=>b.disabled=true);
 try{const {data,error}=await client.from("tickets").update(patch).eq("id",x.id).eq("updated_at",x.updated_at).select(ticketFields).maybeSingle();if(error)throw error;if(!data)throw new Error("stale");if(stamp!==version)return;notice(t("saved"));if(returnToList){current=null;view("workspace");await loadTickets();}else{current=data;renderDetail(data);}}
 catch(error){if(stamp===version)notice(errorText(error),true);}
 finally{if(button.isConnected)button.disabled=false;if(form?.isConnected)form.querySelectorAll("button").forEach(b=>b.disabled=false);}
}
function confirmTrash(x){const dialog=document.createElement("dialog");dialog.innerHTML=`<h2>${t("deleteConfirm")}</h2><p>${t("confirmDeleteText")}</p><div class="actions"><button class="danger" data-confirm>${t("confirm")}</button><button class="secondary" data-cancel>${t("cancel")}</button></div>`;document.body.append(dialog);dialog.querySelector("[data-cancel]").onclick=()=>dialog.close();dialog.querySelector("[data-confirm]").onclick=async event=>{await updateTicket(x,{deleted_at:new Date().toISOString()},event.target);dialog.close();};dialog.onclose=()=>dialog.remove();dialog.showModal();}
function openCreate(){const list=profile.role==="requester"?[profile]:profiles.filter(p=>p.id===profile.id||(p.is_active&&(profile.role==="admin"||p.role==="requester")));if(!list.some(p=>p.id===profile.id))list.unshift(profile);$("createForm").reset();$("requesterField").hidden=profile.role==="requester";$("requester").innerHTML=list.map(p=>`<option value="${esc(p.id)}" ${p.id===profile.id?"selected":""}>${esc(p.full_name)}</option>`).join("");$("priority").innerHTML=options(D.priorities,"Média");$("category").innerHTML=options(D.categories,"Sistemas");$("createError").textContent="";$("createDialog").showModal();}
function openProfile(){const dialog=document.createElement("dialog");dialog.innerHTML=`<h2>${t("profile")}</h2><p>${t("profileHint")}</p><form><div class="field"><label for="profileName">${t("fullName")}</label><input id="profileName" required minlength="2" maxlength="80" value="${esc(profile.full_name)}"></div><div class="field"><label for="profileDepartment">${t("department")}</label><select id="profileDepartment" ${departments.length?"":"disabled"}><option value="">—</option>${departments.map(d=>`<option value="${d.id}" ${d.id===profile.department_id?"selected":""}>${esc(d.name)}</option>`).join("")}</select></div><p role="alert" id="profileError"></p><div class="actions"><button type="submit">${t("save")}</button><button type="button" class="secondary" data-cancel>${t("cancel")}</button></div></form>`;document.body.append(dialog);dialog.onclose=()=>dialog.remove();dialog.querySelector("[data-cancel]").onclick=()=>dialog.close();dialog.querySelector("form").onsubmit=async event=>{event.preventDefault();const stamp=version,name=$("profileName").value.trim();if(name.length<2||name.length>80){$("profileError").textContent=t("profileValidation");return;}const patch={full_name:name};if(!$("profileDepartment").disabled)patch.department_id=$("profileDepartment").value?Number($("profileDepartment").value):null;const buttons=dialog.querySelectorAll("button");buttons.forEach(b=>b.disabled=true);try{const {data,error}=await client.from("profiles").update(patch).eq("id",profile.id).select("id,full_name,email,role,department_id,is_active").single();if(error)throw error;if(stamp!==version)return;profile=data;profiles=profiles.map(p=>p.id===data.id?data:p);identity();renderPeople();dialog.close();notice(t("saved"));}catch(error){if(stamp===version)$("profileError").textContent=errorText(error);}finally{buttons.forEach(b=>b.disabled=false);}};window.HelpDeskAvatar?.enhance(dialog,client,profile.id);dialog.showModal();}
async function createTicket(event){event.preventDefault();const button=event.submitter,stamp=version;button.disabled=true;$("cancelCreate").disabled=true;$("createError").textContent="";try{const requester=profiles.find(p=>p.id===$("requester").value)||profile;const payload=D.createPayload(Object.fromEntries(["title","description","priority","category"].map(id=>[id,$(id).value])),profile,requester);const {error}=await client.from("tickets").insert(payload);if(error)throw error;if(stamp!==version)return;$("createDialog").close();notice(t("created"));page=0;$("scope").value="all";await loadTickets();}catch(error){if(stamp===version)$("createError").textContent=errorText(error);}finally{button.disabled=false;$("cancelCreate").disabled=false;}}
function clearSession(){window.HelpDeskGoogle.resetApprovals();version++;loading=false;profile=null;window.HelpDeskAvatar?.refresh(client,null);lastUser=null;tickets=[];profiles=[];departments=[];current=null;page=0;$("tickets").replaceChildren();$("detail").replaceChildren();$("people").replaceChildren();$("stats").replaceChildren();$("identity").textContent="";$("password").value="";$("createForm").reset();$("search").value="";$("statusFilter").value="";$("scope").value="all";document.querySelectorAll("dialog[open]").forEach(d=>d.close());view("welcome");}
async function sessionChanged(session) {
    if (window.HelpDeskRecovery.active()) return;
    if (session && profile && lastUser === session.user.id) return;
    const token = ++authVersion;
    if (!(await window.HelpDeskGoogle.beforeSession(session)) || token !== authVersion) return;
    if (!session) { clearSession(); notice(""); return; }
    clearSession(); notice(t("authChecking"));
    try {
        const { data, error } = await client.from("profiles").select("id,full_name,email,role,department_id,is_active").eq("id", session.user.id).single();
        if (token !== authVersion) return;
        if (!error && data && !data.is_active) {
            const messageKey = await window.HelpDeskGoogle.inactiveProfileMessage(session, data);
            if (token === authVersion) { view("auth"); notice(t(messageKey), true); }
            return;
        }
        if (error || !data?.is_active || !["admin", "technician", "requester"].includes(data.role)) {
            view("auth"); notice(t(window.HelpDeskGoogle.missingProfile(session)), true); return;
        }
        if (!(await window.HelpDeskGoogle.acceptProfile(session, data)) || token !== authVersion) return;
        profile = data; lastUser = session.user.id; identity(); renderFilters(); notice(""); view("workspace");
        await loadDirectory();
        if (token === authVersion) window.HelpDeskGoogle.loadApprovals();
        if (token === authVersion) await loadTickets();
    } catch (error) { if (token === authVersion) { view("auth"); notice(errorText(error), true); } }
}
$("language").onchange=()=>{C.set($("language").value);translate();};
$("enter").onclick=()=>{notice("");view("auth");$("email").focus();};document.querySelectorAll("[data-login]").forEach(b=>b.onclick=$("enter").onclick);
$("back").onclick=()=>{notice("");view("welcome");};
$("loginForm").onsubmit=async event=>{event.preventDefault();if(!client){notice(t("sdk"),true);return;}const button=event.submitter;window.HelpDeskGoogle.passwordLogin();button.disabled=true;button.textContent=t("loading");notice("");try{const {data,error}=await client.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(error)throw error;$("password").value="";await sessionChanged(data.session);}catch(error){notice(errorText(error),true);}finally{button.disabled=false;button.textContent=t("login");}};
$("logout").onclick=async event=>{event.target.disabled=true;try{const {error}=await client.auth.signOut();if(error)throw error;authVersion++;clearSession();notice("");}catch(error){notice(errorText(error),true);}finally{event.target.disabled=false;}};
$("refresh").onclick=()=>{notice("");loadTickets();};$("newTicket").onclick=openCreate;$("cancelCreate").onclick=()=>$("createDialog").close();$("createForm").onsubmit=createTicket;
$("myProfile").onclick=openProfile;
$("search").oninput=renderTickets;$("statusFilter").onchange=renderTickets;$("scope").onchange=()=>{page=0;loadTickets();};$("previous").onclick=()=>{if(page&&!loading){page--;loadTickets();}};$("next").onclick=()=>{if(!loading){page++;loadTickets();}};
$("tickets").onclick=event=>{const button=event.target.closest("[data-detail]");if(button){current=tickets.find(x=>String(x.id)===button.dataset.detail);if(current){view("detail");renderDetail(current);}}};
translate();view("welcome");
try{client=supabaseClient;}catch{notice(t("sdk"),true);return;}
window.HelpDeskGoogle.start(client,{view,notice,clear:clearSession,session:sessionChanged,profile:()=>profile,url:SUPABASE_URL,key:SUPABASE_PUBLISHABLE_KEY});
window.HelpDeskRecovery.start(client,{view,notice,clear:clearSession});
// Keep the auth callback synchronous; database work runs outside the Auth lock.
client.auth.onAuthStateChange((event,session)=>{if(window.HelpDeskRecovery.onAuth(event,session))return;if(window.HelpDeskGoogle.onAuth(event,session))return;if(event==="TOKEN_REFRESHED"&&profile)return;window.setTimeout(()=>sessionChanged(session),0);});
client.auth.getSession().then(({data,error})=>{if(error){notice(errorText(error),true);return;}sessionChanged(data.session);}).catch(error=>notice(errorText(error),true));
window.HelpDesk={refresh:translate,boot:()=>client.auth.getSession().then(({data})=>sessionChanged(data.session))};
})();





