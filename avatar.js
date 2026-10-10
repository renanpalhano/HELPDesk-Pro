(function(){
"use strict";
const t=key=>window.HelpDeskCopy.t(key);
let generation=0;
async function refresh(client,id){
 const stamp=++generation,slot=document.getElementById("avatarSlot");slot.replaceChildren();slot.hidden=!id;if(!id||!client.storage)return;
 const fallback=document.createElement("span");fallback.className="avatar-fallback";fallback.textContent="●";slot.append(fallback);
 try{const {data,error}=await client.storage.from("profile-photos").createSignedUrl(id+"/avatar.jpg",3600);if(error||stamp!==generation||!data?.signedUrl)return;const img=new Image();img.alt="";img.className="avatar-image";img.onload=()=>{if(stamp===generation)slot.replaceChildren(img);};img.src=data.signedUrl;}catch{/* Photo is optional. */}
}
async function prepare(file){
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5*1024*1024)throw new Error("photo_invalid");
 const bitmap=await createImageBitmap(file);try{if(bitmap.width*bitmap.height>40000000)throw new Error("photo_invalid");const canvas=document.createElement("canvas");canvas.width=canvas.height=256;const ctx=canvas.getContext("2d"),side=Math.min(bitmap.width,bitmap.height);ctx.fillStyle="#fff";ctx.fillRect(0,0,256,256);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("photo_invalid")),"image/jpeg",.85));}finally{bitmap.close();}
}
function enhance(dialog,client,id){
 if(!client.storage)return;const section=document.createElement("section");section.className="photo-settings";
 const label=document.createElement("label");label.textContent=t("photoLabel");const input=document.createElement("input");input.type="file";input.accept="image/jpeg,image/png,image/webp";label.append(input);
 const hint=document.createElement("small");hint.textContent=t("photoHint");const state=document.createElement("p");state.setAttribute("role","status");
 const remove=document.createElement("button");remove.type="button";remove.className="secondary";remove.textContent=t("photoRemove");section.append(label,hint,state,remove);dialog.querySelector("form").before(section);
 async function act(operation){input.disabled=remove.disabled=true;state.textContent=t("loading");try{await operation();await refresh(client,id);state.textContent=t("photoSaved");}catch(error){state.textContent=error.message==="photo_invalid"?t("photoInvalid"):t("photoFailed");}finally{input.disabled=remove.disabled=false;input.value="";}}
 input.onchange=()=>{const file=input.files[0];if(file)act(async()=>{const blob=await prepare(file);const {error}=await client.storage.from("profile-photos").upload(id+"/avatar.jpg",blob,{upsert:true,contentType:"image/jpeg",cacheControl:"0"});if(error)throw error;});};
 remove.onclick=()=>act(async()=>{const {error}=await client.storage.from("profile-photos").remove([id+"/avatar.jpg"]);if(error)throw error;});
}
window.HelpDeskAvatar={refresh,enhance};
})();
