const ROMA_API = (window.ROMA_API_URL || "https://roma-api.onrender.com").replace(/\/$/,"");
document.addEventListener("DOMContentLoaded",()=>{
 const toggle=document.querySelector(".menu-toggle"),nav=document.querySelector(".main-nav");
 if(toggle&&nav)toggle.addEventListener("click",()=>{const open=nav.classList.toggle("open");toggle.setAttribute("aria-expanded",String(open));});
 document.querySelectorAll("[data-local-form]").forEach(form=>form.addEventListener("submit",async e=>{
  e.preventDefault();const data=Object.fromEntries(new FormData(form).entries());const notice=form.querySelector(".form-notice"),button=form.querySelector('button[type="submit"]');
  const type=form.dataset.localForm==="adopcion"?"adopcion":form.dataset.localForm==="hogar transitorio"?"transitorio":"contacto";
  const payload={type,name:data.nombre,email:data.email,phone:data.celular||"",city:data.localidad||"",subject:data.motivo||data.asunto||"",message:[data.mensaje,data.motivo,data.vivienda&&"Vivienda: "+data.vivienda,data.otrasMascotas&&"Otras mascotas: "+data.otrasMascotas,data.cualesMascotas&&"Cuáles: "+data.cualesMascotas,data.experiencia&&"Experiencia: "+data.experiencia,data.edad&&"Edad: "+data.edad,data.adopciones&&"Adopciones anteriores: "+data.adopciones].filter(Boolean).join("\n")};
  if(notice)notice.textContent="Enviando solicitud…";if(button)button.disabled=true;
  try{const response=await fetch(ROMA_API+"/api/requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error||"No se pudo enviar.");if(notice)notice.textContent=result.message;form.reset();}
  catch(err){if(notice)notice.textContent=err.message==="Failed to fetch"?"No pudimos conectar con el servidor. El backend debe estar desplegado para recibir solicitudes.":err.message;}
  finally{if(button)button.disabled=false;}
 }));
 const launch=document.querySelector(".chat-launch"),panel=document.querySelector(".chat-panel"),close=document.querySelector(".chat-close");
 if(launch&&panel){launch.addEventListener("click",()=>panel.hidden=!panel.hidden);close?.addEventListener("click",()=>panel.hidden=true);
  const chatForm=panel.querySelector(".chat-form"),messages=panel.querySelector(".chat-messages");
  chatForm?.addEventListener("submit",async e=>{e.preventDefault();const input=chatForm.elements.question,q=input.value.trim();if(!q)return;
   const user=document.createElement("p");user.className="user-message";user.textContent=q;messages.append(user);input.value="";
   const bot=document.createElement("p");bot.className="bot-message";bot.textContent="Estoy pensando…";messages.append(bot);messages.scrollTop=messages.scrollHeight;
   try{const response=await fetch(ROMA_API+"/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:q})});const result=await response.json();bot.textContent=response.ok?result.answer:(result.error||"El asistente no está disponible.");}
   catch{bot.textContent="No pude conectar con el asistente. Intentá nuevamente más tarde.";}messages.scrollTop=messages.scrollHeight;
  });
 }
 const romaCarousel=document.querySelector("[data-roma-carousel]");
 if(romaCarousel){
  const slides=[...romaCarousel.querySelectorAll(".roma-slide")],dots=[...romaCarousel.querySelectorAll(".roma-dots button")],counter=romaCarousel.querySelector(".roma-counter");
  let current=0;
  const show=(index)=>{current=(index+slides.length)%slides.length;slides.forEach((slide,i)=>{slide.classList.toggle("is-active",i===current);slide.setAttribute("aria-hidden",String(i!==current));});dots.forEach((dot,i)=>{dot.classList.toggle("is-active",i===current);dot.setAttribute("aria-pressed",String(i===current));});if(counter)counter.textContent=String(current+1).padStart(2,"0")+" / "+String(slides.length).padStart(2,"0");};
  romaCarousel.querySelector(".roma-prev")?.addEventListener("click",()=>show(current-1));
  romaCarousel.querySelector(".roma-next")?.addEventListener("click",()=>show(current+1));
  dots.forEach((dot,i)=>dot.addEventListener("click",()=>show(i)));
  // Avance automático, pausado mientras la persona interactúa con el carrusel.
  let autoplay=setInterval(()=>show(current+1),4500);
  const pause=()=>{if(autoplay){clearInterval(autoplay);autoplay=null;}};
  const resume=()=>{if(!autoplay&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){autoplay=setInterval(()=>show(current+1),4500);}};
  romaCarousel.addEventListener("mouseenter",pause);
  romaCarousel.addEventListener("mouseleave",resume);
  romaCarousel.addEventListener("focusin",pause);
  romaCarousel.addEventListener("focusout",resume);
  romaCarousel.addEventListener("touchstart",pause,{passive:true});
  romaCarousel.addEventListener("touchend",resume,{passive:true});
  show(0);
  resume();
 }

});