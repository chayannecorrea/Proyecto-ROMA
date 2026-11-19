const ROMA_API=(window.ROMA_API_URL||"https://roma-api.onrender.com").replace(/\/$/,"");
document.addEventListener("DOMContentLoaded",()=>{
 const login=document.getElementById("login-form");
 if(login)login.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(login),notice=login.querySelector(".admin-notice"),button=login.querySelector('button[type="submit"]');button.disabled=true;notice.textContent="Verificando acceso…";
  try{const r=await fetch(ROMA_API+"/api/admin/login",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:f.get("email"),password:f.get("password")})});const data=await r.json();if(!r.ok)throw new Error(data.error||"No se pudo ingresar.");location.href="dashboard.html";}
  catch(err){notice.textContent=err.message==="Failed to fetch"?"No se pudo conectar con el servidor.":err.message;button.disabled=false;}
 });
 if(location.pathname.endsWith("dashboard.html")){
  const list=document.getElementById("request-list");
  const load=async()=>{try{const r=await fetch(ROMA_API+"/api/admin/requests",{credentials:"include"});if(r.status===401){location.href="login.html";return;}const data=await r.json();if(!r.ok)throw new Error(data.error);list.innerHTML="";if(!data.requests.length){list.textContent="Todavía no hay solicitudes recibidas.";return;}
   data.requests.forEach(x=>{const article=document.createElement("article");article.className="request-item";const title=document.createElement("strong");title.textContent=x.type+" · "+x.name;const details=document.createElement("p");details.textContent=[x.email,x.phone,x.city,x.subject,x.message].filter(Boolean).join(" | ");const date=document.createElement("small");date.textContent=new Date(x.created_at).toLocaleString("es-UY");const status=document.createElement("select");status.setAttribute("aria-label","Estado de solicitud");[["pendiente","Pendiente"],["en_revision","En revisión"],["resuelta","Resuelta"]].forEach(([v,t])=>{const o=document.createElement("option");o.value=v;o.textContent=t;status.append(o);});status.value=x.status;status.addEventListener("change",async()=>{const update=await fetch(ROMA_API+"/api/admin/requests/"+x.id,{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:status.value})});if(!update.ok)alert("No se pudo actualizar el estado.");});article.append(title,details,date,status);list.append(article);});
  }catch(err){list.textContent=err.message||"No se pudieron cargar las solicitudes.";}}
  load();document.getElementById("logout")?.addEventListener("click",async()=>{await fetch(ROMA_API+"/api/admin/logout",{method:"POST",credentials:"include"});location.href="login.html";});
 }
});