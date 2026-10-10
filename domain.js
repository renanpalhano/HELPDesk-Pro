(function(root){
    "use strict";
    const transitions={"Aberto":["Em atendimento","Encerrado"],"Em atendimento":["Aberto","Resolvido","Encerrado"],"Resolvido":["Em atendimento","Encerrado"],"Encerrado":["Aberto"]};
    const priorities=["Baixa","Média","Alta","Crítica"];
    const categories=["Hardware","Software","Rede","Acesso","E-mail","Impressão","Sistemas","Segurança"];
    function canAssign(profile,ticket){return profile.role==="admin" || (profile.role==="technician" && (!ticket.assigned_to || ticket.assigned_to===profile.id));}
    function createPayload(values,profile,requester){
        const title=values.title.trim(),description=values.description.trim();
        if(title.length<5 || title.length>120 || description.length<10 || description.length>1000) throw new Error("validation");
        if(!priorities.includes(values.priority)||!categories.includes(values.category)) throw new Error("validation");
        if(profile.role==="requester" && requester.id!==profile.id) throw new Error("permission");
        if(profile.role==="technician" && requester.id!==profile.id && (requester.role!=="requester" || !requester.is_active)) throw new Error("permission");
        return {title,description,priority:values.priority,category:values.category,department_id:requester.department_id || null,requester_id:requester.id};
    }
    root.HelpDeskDomain={transitions,priorities,categories,canAssign,createPayload};
})(typeof window!=="undefined"?window:globalThis);
