(function(){
"use strict";
var SB_URL="https://vquylykjjctrhcksppba.supabase.co";
var SB_KEY="sb_publishable_atCR-ZIVwKqIJ9Ktfhl5ZQ_-GPR1nX4";
var FACH="Current Trends";
var sb=window.supabase.createClient(SB_URL,SB_KEY);

var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
function esc(t){var d=document.createElement("div");d.textContent=t==null?"":String(t);return d.innerHTML}
function toast(m){var t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(function(){t.hidden=true},2400)}
function iso(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function pd(s){var a=s.split("-");return new Date(+a[0],+a[1]-1,+a[2])}
function fmt(s){var d=pd(s);return String(d.getDate()).padStart(2,"0")+"."+String(d.getMonth()+1).padStart(2,"0")+"."}
var now=new Date();now.setHours(0,0,0,0);var TODAY=iso(now);
function diff(s){return Math.round((pd(s)-now)/86400000)}
function nf(n,d){return n.toLocaleString("de-DE",{minimumFractionDigits:d||0,maximumFractionDigits:d||0})}
var MON=["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
var TABS=[["uebersicht","Übersicht"],["kalender","Kalender"],["aufgaben","Aufgaben"],["dokumente","Dokumente"],["lernen","Lernen"],["unterricht","Unterricht"],["rechner","Rechner"],["upload","Upload"]];

/* ---------- Zustand ---------- */
var items=[],beitr=[],pers={},me=null,isAdmin=false,sessF="",lastLoad=0;
function by(s){return items.filter(function(i){return i.sammlung===s&&i.fach===FACH})}
function pget(k,d){return pers[k]===undefined?d:pers[k]}
var ptimers={};
function pset(k,v){pers[k]=v;clearTimeout(ptimers[k]);ptimers[k]=setTimeout(function(){
  sb.from("persoenlich").upsert({email:me.email,key:k,value:v},{onConflict:"email,key"}).then(function(r){if(r.error)toast("Speichern fehlgeschlagen")})},600)}
function byDate(a,b){return (a.datum||"9999")<(b.datum||"9999")?-1:1}

/* ---------- Anmeldung ---------- */
function show(id){["login","nope","app"].forEach(function(x){$("#"+x).hidden=(x!==id)})}
var lgMail="";
function lgMsg(t){$("#lgMsg").textContent=t||""}
$("#lgSend").addEventListener("click",async function(){
  var m=$("#lgMail").value.trim().toLowerCase();if(!m){lgMsg("Bitte E-Mail-Adresse eingeben.");return}
  lgMsg("Sende Code ...");this.disabled=true;
  var r=await sb.auth.signInWithOtp({email:m,options:{shouldCreateUser:true}});
  this.disabled=false;
  if(r.error){lgMsg("Das hat nicht geklappt: "+r.error.message);return}
  lgMail=m;$("#lg1").hidden=true;$("#lg2").hidden=false;lgMsg("Wir haben einen Code an "+m+" geschickt.");$("#lgCode").focus();
});
$("#lgOk").addEventListener("click",async function(){
  var c=$("#lgCode").value.replace(/\s/g,"");if(!c){lgMsg("Bitte den Code eingeben.");return}
  this.disabled=true;
  var r=await sb.auth.verifyOtp({email:lgMail,token:c,type:"email"});
  this.disabled=false;
  if(r.error){lgMsg("Code ungültig oder abgelaufen.");return}
  boot();
});
$("#lgBack").addEventListener("click",function(){$("#lg2").hidden=true;$("#lg1").hidden=false;lgMsg("")});
$("#lgCode").addEventListener("keydown",function(e){if(e.key==="Enter")$("#lgOk").click()});
$("#lgMail").addEventListener("keydown",function(e){if(e.key==="Enter")$("#lgSend").click()});
async function logout(){await sb.auth.signOut();location.reload()}
$("#nopeOut").addEventListener("click",logout);
$("#who").addEventListener("click",function(){if(confirmOut())logout()});
var outArmed=false;
function confirmOut(){if(outArmed){outArmed=false;return true}outArmed=true;toast("Nochmal tippen zum Abmelden");setTimeout(function(){outArmed=false},3000);return false}

/* ---------- Laden ---------- */
async function loadData(){
  var r=await Promise.all([
    sb.from("items").select("*").eq("fach",FACH).order("erstellt_am",{ascending:true}).limit(5000),
    sb.from("beitraege").select("*").eq("fach",FACH).order("erstellt_am",{ascending:false}).limit(1000),
    sb.from("persoenlich").select("key,value")
  ]);
  if(r[0].error||r[1].error){toast("Laden fehlgeschlagen");return false}
  items=r[0].data||[];beitr=r[1].data||[];
  pers={};(r[2].data||[]).forEach(function(x){pers[x.key]=x.value});
  lastLoad=Date.now();return true;
}
async function boot(){
  var s=(await sb.auth.getSession()).data.session;
  if(!s){show("login");return}
  var email=(s.user.email||"").toLowerCase();
  var m=await sb.from("members").select("email,role").ilike("email",email).limit(1);
  if(m.error||!m.data||!m.data.length){$("#nopeTxt").textContent=email+" steht nicht auf der Mitgliederliste. Bitte Kilian um Freigabe.";show("nope");return}
  me={email:email,role:m.data[0].role};isAdmin=me.role==="admin";
  document.body.classList.toggle("viewer",!isAdmin);
  $("#who").textContent=email.split("@")[0];
  var ok=await loadData();
  show("app");
  if(ok){renderAll();initStatic()}
  go((location.hash||"").replace("#",""));
}
document.addEventListener("visibilitychange",async function(){
  if(document.visibilityState==="visible"&&me&&Date.now()-lastLoad>30000){if(await loadData())renderAll()}
});

/* ---------- Übersicht, Aufgaben, Termine ---------- */
function tasks(){return by("aufgabe")}
function renderStats(){
  var open=tasks().filter(function(k){return !k.erledigt});
  $("#s1").textContent=open.filter(function(k){return k.datum===TODAY}).length;
  $("#s2").textContent=open.filter(function(k){if(!k.datum)return false;var n=diff(k.datum);return n>0&&n<=7}).length;
  $("#s3").textContent=open.length;
}
function taskRow(k){
  return '<div class="row'+(k.erledigt?' done':'')+'"><button class="chk" data-id="'+k.id+'" aria-pressed="'+(k.erledigt?'true':'false')+'" aria-label="Erledigt"'+(isAdmin?'':' disabled')+'></button><div class="t">'+esc(k.titel)+'</div><div class="d">'+(k.datum?fmt(k.datum):'')+'</div></div>';
}
function renderTasks(){
  var seg=$("#tSeg .tab[aria-selected='true']");var mode=seg?seg.dataset.t:"open";
  if(mode==="new"&&!isAdmin)mode="open";
  var list=tasks().filter(function(k){return mode==="done"?k.erledigt:!k.erledigt}).sort(byDate);
  $("#taskList").hidden=(mode==="new");$("#taskNew").hidden=(mode!=="new");
  $("#taskList").innerHTML=list.length?list.map(taskRow).join(""):'<p class="muted">Nichts in dieser Liste.</p>';
  var ov=tasks().filter(function(k){return !k.erledigt}).sort(byDate).slice(0,4);
  $("#ovTasks").innerHTML=ov.length?ov.map(taskRow).join(""):'<p class="muted">Alles erledigt.</p>';
  renderStats();
}
document.addEventListener("click",async function(e){
  var c=e.target.closest(".chk");if(!c||!isAdmin)return;
  var t=items.find(function(x){return x.id===c.dataset.id});if(!t)return;
  t.erledigt=!t.erledigt;renderTasks();
  var r=await sb.from("items").update({erledigt:t.erledigt}).eq("id",t.id);
  if(r.error){t.erledigt=!t.erledigt;renderTasks();toast("Speichern fehlgeschlagen")}
});
$("#tSeg").addEventListener("click",function(e){var b=e.target.closest(".tab");if(!b)return;$$("#tSeg .tab").forEach(function(x){x.setAttribute("aria-selected",x===b?"true":"false")});renderTasks()});
async function addItem(row){
  var r=await sb.from("items").insert(Object.assign({fach:FACH},row)).select().single();
  if(r.error){toast("Speichern fehlgeschlagen");return null}
  items.push(r.data);return r.data;
}
$("#ntAdd").addEventListener("click",async function(){
  var t=$("#nt").value.trim();if(!t){toast("Bitte eine Aufgabe eingeben");return}
  if(await addItem({sammlung:"aufgabe",titel:t,datum:$("#nd").value||null})){$("#nt").value="";renderTasks();toast("Aufgabe hinzugefügt")}
});
$("#bnAdd").addEventListener("click",async function(){
  var ls=$("#bn").value.split("\n").map(function(s){return s.trim()}).filter(Boolean);
  if(!ls.length){toast("Bitte eine Notiz eingeben");return}
  var n=0;for(var i=0;i<ls.length;i++){if(await addItem({sammlung:"aufgabe",titel:ls[i]}))n++}
  $("#bn").value="";renderTasks();toast(n+" Aufgabe(n) übernommen");
});

function events(){return by("termin").filter(function(e){return e.datum}).sort(byDate)}
function evRow(e){return '<div class="row"><div class="t"><div>'+esc(e.titel)+'</div><div class="muted small">'+esc(e.inhalt||"")+'</div></div><div class="d">'+fmt(e.datum)+'</div></div>'}
function renderOv(){
  var ev=events(),n=ev.filter(function(e){return diff(e.datum)>=0})[0];
  if(n){var d=diff(n.datum);$("#nextTitle").textContent=n.titel;$("#nextSub").textContent=fmt(n.datum)+" · "+(d===0?"heute":d===1?"morgen":"in "+d+" Tagen")+(n.inhalt?" · "+n.inhalt:"")}
  else{$("#nextTitle").textContent="Keine Termine";$("#nextSub").textContent=""}
  var up=ev.filter(function(e){return diff(e.datum)>=0}).slice(0,4);
  $("#ovEvents").innerHTML=up.length?up.map(evRow).join(""):'<p class="muted">Keine anstehenden Termine.</p>';
}
var cy=now.getFullYear(),cm=now.getMonth();
function renderCal(){
  $("#mName").textContent=MON[cm]+" "+cy;
  var first=new Date(cy,cm,1),off=(first.getDay()+6)%7,dim=new Date(cy,cm+1,0).getDate(),h="",ev=events();
  ["Mo","Di","Mi","Do","Fr","Sa","So"].forEach(function(w){h+='<div class="w">'+w+'</div>'});
  for(var i=0;i<off;i++)h+='<div></div>';
  for(var d=1;d<=dim;d++){var s=cy+"-"+String(cm+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
    var has=ev.some(function(e){return e.datum===s});
    h+='<div class="day'+(has?' ev':'')+(s===TODAY?' today':'')+'">'+d+'</div>'}
  $("#cal").innerHTML=h;
  var list=ev.filter(function(e){var a=pd(e.datum);return a.getFullYear()===cy&&a.getMonth()===cm});
  $("#evHead").textContent="Termine im "+MON[cm];
  $("#evList").innerHTML=list.length?list.map(evRow).join(""):'<p class="muted">Keine Termine in diesem Monat.</p>';
}
$("#mPrev").addEventListener("click",function(){cm--;if(cm<0){cm=11;cy--}renderCal()});
$("#mNext").addEventListener("click",function(){cm++;if(cm>11){cm=0;cy++}renderCal()});

/* Bereitschaft */
var STEPS=["Gelesen","Verstanden","Geübt"];
function renderReady(){
  var papers=by("paper"),b=pget("bereit",{});
  $("#ready").innerHTML=papers.length?papers.map(function(p,i){var r=b[p.id]||[0,0,0],n=r.reduce(function(a,c){return a+c},0);
    return '<div style="padding:10px 0;'+(i?'border-top:1px solid var(--line)':'')+'"><div style="display:flex;justify-content:space-between;gap:8px"><span>'+esc(p.titel)+'</span><span class="muted small num">'+n+' von 3</span></div><div class="bar2" style="margin:8px 0"><i style="width:'+(n/3*100)+'%"></i></div><div class="step">'+STEPS.map(function(s,j){return '<button data-p="'+p.id+'" data-s="'+j+'" aria-pressed="'+(r[j]?'true':'false')+'">'+s+'</button>'}).join("")+'</div></div>'}).join(""):'<p class="muted">Noch keine Papers eingetragen.</p>';
}
$("#ready").addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;
  var all=pget("bereit",{}),r=(all[b.dataset.p]||[0,0,0]).slice(),s=+b.dataset.s;r[s]=r[s]?0:1;all[b.dataset.p]=r;pset("bereit",all);renderReady()});

/* Bereiche, Anwesenheit, Fragen */
var AR=[["dokumente","Dokumente","Verständnis und Unterrichtsversionen"],["lernen","Lernen","Kernaussagen, Glossar, Landkarte"],["rechner","Rechner","Cap Rate und Preis"],["upload","Upload","Dateien ablegen"],["kalender","Kalender","Fristen und Sessions"],["aufgaben","Aufgaben","Offen und erledigt"]];
$("#areas").innerHTML=AR.map(function(a){return '<button class="card tile" data-go="'+a[0]+'"><h3>'+a[1]+'</h3><span class="s">'+a[2]+'</span></button>'}).join("");
function ra(){$("#aVal").textContent=pget("fehl",0)}
$("#aPlus").addEventListener("click",function(){pset("fehl",pget("fehl",0)+1);ra()});
$("#aMinus").addEventListener("click",function(){var v=pget("fehl",0);if(v>0)pset("fehl",v-1);ra()});
function rq(){
  var l=by("dozentenfrage");
  var h=l.length?l.map(function(q){return '<div class="row"><div class="t">'+esc(q.titel)+'</div></div>'}).join(""):'<p class="muted">Noch keine Fragen notiert.</p>';
  $("#qList").innerHTML=h;$("#uqList").innerHTML=h;
}
$("#qAdd").addEventListener("click",async function(){var v=$("#qIn").value.trim();if(!v)return;if(await addItem({sammlung:"dozentenfrage",titel:v})){$("#qIn").value="";rq()}});

/* ---------- Dokumente ---------- */
var GROUPS=["Verständnis","Unterrichtsversion","Prüfungsstoff","Unterlagen"];
async function openFile(path){
  var w=window.open("","_blank");
  var r=await sb.storage.from("dateien").createSignedUrl(path,300);
  if(r.error){if(w)w.close();toast("Datei nicht verfügbar");return}
  if(w)w.location.href=r.data.signedUrl;else location.href=r.data.signedUrl;
}
document.addEventListener("click",function(e){var b=e.target.closest("[data-open]");if(b)openFile(b.dataset.open)});
function renderDocs(){
  var docs=by("dokument"),gs=[];
  GROUPS.forEach(function(g){gs.push(g)});
  docs.forEach(function(d){var g=(d.daten&&d.daten.gruppe)||"Unterlagen";if(gs.indexOf(g)<0)gs.push(g)});
  var h=gs.map(function(g){
    var l=docs.filter(function(d){return ((d.daten&&d.daten.gruppe)||"Unterlagen")===g});
    if(!l.length)return"";
    return '<div><div class="hd"><h3>'+esc(g)+'</h3></div><div class="card">'+l.map(function(d){
      var p=d.daten&&d.daten.pfad;
      return '<div class="row"><div class="t"><div>'+esc(d.titel)+'</div><div class="muted small">'+esc(d.inhalt||"")+'</div></div>'+(p?'<button class="btn ghost" data-open="'+esc(p)+'">Öffnen</button>':'')+'</div>'}).join("")+'</div></div>'}).join("");
  var b='<div><div class="hd"><h3>Beiträge</h3></div><div class="card">'+(beitr.length?beitr.map(function(x){
    return '<div class="row"><div class="t"><div>'+esc(x.titel)+'</div><div class="muted small">von '+esc((x.von||"").split("@")[0])+' · '+esc(x.status)+'</div></div>'+(x.datei_pfad?'<button class="btn ghost" data-open="'+esc(x.datei_pfad)+'">Öffnen</button>':'')+'</div>'}).join(""):'<p class="muted">Noch keine Beiträge.</p>')+'</div></div>';
  $("#docs").innerHTML=(h||'<div class="card"><p class="muted">Noch keine Dokumente.</p></div>')+b;
}

/* ---------- Lernen ---------- */
function sessions(){var s={};["kernaussage","glossar","frage","zweiminuten"].forEach(function(k){by(k).forEach(function(i){if(i.session)s[i.session]=1})});return Object.keys(s).sort()}
function lf(k){return by(k).filter(function(i){return !sessF||i.session===sessF})}
function det(list,first){
  return list.length?list.map(function(i,n){return '<details'+(n===0&&first?' open':'')+'><summary>'+esc(i.titel)+'</summary>'+(i.inhalt||"").split("\n").filter(Boolean).map(function(p){return '<p>'+esc(p)+'</p>'}).join("")+'</details>'}).join(""):'<p class="muted">Noch nichts eingetragen.</p>';
}
function renderLernen(){
  var ss=sessions(),sel=$("#sessF");
  sel.innerHTML='<option value="">Alle Sessions</option>'+ss.map(function(s){return '<option'+(s===sessF?' selected':'')+'>'+esc(s)+'</option>'}).join("");
  $("#l-kern").innerHTML=det(lf("kernaussage"),true);
  $("#l-zwei").innerHTML=det(lf("zweiminuten"),true);
  rg();
  var qa=lf("frage");
  $("#l-fragen").innerHTML=qa.length?qa.map(function(q,i){return '<div class="q" style="padding:12px 0;'+(i?'border-top:1px solid var(--line)':'')+'"><div style="font-weight:500">'+esc(q.titel)+'</div><button class="btn ghost" data-qa="'+i+'">Antwort zeigen</button><div class="ans" id="qa'+i+'" hidden>'+esc(q.inhalt||"")+'</div></div>'}).join(""):'<p class="muted">Noch keine Fragen eingetragen.</p>';
}
function rg(){
  var q=$("#gs").value.toLowerCase();
  var l=lf("glossar").filter(function(g){return ((g.titel||"")+(g.inhalt||"")).toLowerCase().indexOf(q)>-1}).sort(function(a,b){return a.titel.localeCompare(b.titel,"de")});
  $("#gl").innerHTML=l.length?l.map(function(g){return '<div class="row" style="align-items:flex-start"><div class="t"><div style="font-weight:500">'+esc(g.titel)+'</div><div class="muted">'+esc(g.inhalt||"")+'</div></div></div>'}).join(""):'<p class="muted">Kein Begriff gefunden.</p>';
}
$("#gs").addEventListener("input",rg);
$("#sessF").addEventListener("change",function(){sessF=this.value;renderLernen()});
$("#l-fragen").addEventListener("click",function(e){var b=e.target.closest("[data-qa]");if(!b)return;var a=$("#qa"+b.dataset.qa);a.hidden=!a.hidden;b.textContent=a.hidden?"Antwort zeigen":"Antwort verbergen"});
$("#lSeg").addEventListener("click",function(e){
  var b=e.target.closest(".tab");if(!b)return;
  $$("#lSeg .tab").forEach(function(x){x.setAttribute("aria-selected",x===b?"true":"false")});
  ["kern","gloss","karte","fragen","quad","zwei","fp"].forEach(function(k){var el=$("#l-"+k);el.hidden=(k!==b.dataset.l);el.style.display=(!el.hidden&&(k==="quad"||k==="fp"))?"flex":""});
});

/* ---------- Unterricht ---------- */
function ru(){
  var n=events().filter(function(e){return diff(e.datum)>=0})[0];
  $("#uNext").textContent=n?n.titel+" · "+fmt(n.datum):"Keine Session";
  var m=by("merksatz");
  $("#uMerk").innerHTML=m.length?m.map(function(x){return '<div class="row"><div class="t">'+esc(x.titel)+'</div></div>'}).join(""):'<p class="muted">Noch keine Merksätze.</p>';
}
$("#bigBtn").addEventListener("click",function(){var b=$("#ubody");b.classList.toggle("big-text");$("#bigBtn").textContent=b.classList.contains("big-text")?"Normale Schrift":"Große Schrift"});
$("#un").addEventListener("input",function(){pset("notiz",this.value)});

/* ---------- Suche ---------- */
function idx(){
  var a=[];
  tasks().forEach(function(k){a.push(["Aufgabe",k.titel,"aufgaben"])});
  events().forEach(function(e){a.push(["Termin",e.titel+" · "+(e.inhalt||"")+" · "+fmt(e.datum),"kalender"])});
  by("glossar").forEach(function(g){a.push(["Glossar",g.titel+": "+(g.inhalt||""),"lernen"])});
  by("frage").forEach(function(q){a.push(["Prüfungsfrage",q.titel,"lernen"])});
  by("kernaussage").concat(by("zweiminuten")).forEach(function(k){a.push(["Lernen",k.titel+": "+(k.inhalt||""),"lernen"])});
  by("merksatz").forEach(function(k){a.push(["Merksatz",k.titel,"unterricht"])});
  by("dokument").forEach(function(d){a.push(["Dokument",d.titel,"dokumente"])});
  beitr.forEach(function(b){a.push(["Beitrag",b.titel,"dokumente"])});
  by("dozentenfrage").forEach(function(q){a.push(["Frage",q.titel,"uebersicht"])});
  return a;
}
var gse=$("#gsearch");
gse.addEventListener("input",function(){
  var q=gse.value.trim().toLowerCase(),sec=$("[data-p='suche']");
  if(!q){if(!sec.hidden)go("uebersicht");return}
  if(sec.hidden)go("suche");
  var r=idx().filter(function(x){return x[1].toLowerCase().indexOf(q)>-1}).slice(0,100);
  $("#sSub").textContent=r.length+" Treffer";
  $("#sRes").innerHTML=r.length?r.map(function(x){return '<button class="hit" data-go="'+x[2]+'"><span>'+esc(x[1].length>140?x[1].slice(0,140)+"…":x[1])+'</span><span class="muted small">'+x[0]+'</span></button>'}).join(""):'<p class="muted">Nichts gefunden.</p>';
});
document.addEventListener("click",function(e){var g=e.target.closest("[data-go]");if(g&&g.dataset.go!=="suche"&&!g.classList.contains("hit")){gse.value=""}});

/* ---------- Upload ---------- */
var upl=[];
function safe(n){return n.replace(/[^\w.\-]+/g,"_")}
async function addFiles(fl){
  var target=$("#ut").value;if(target==="main"&&!isAdmin)target="beitr";
  var title=$("#utt").value.trim();
  for(var i=0;i<fl.length;i++){
    var f=fl[i],entry={name:f.name,state:"lädt hoch …"};upl.push(entry);drawUpl();
    var path=(target==="main"?"dokumente/":"beitraege/")+Date.now()+"-"+safe(f.name);
    var r=await sb.storage.from("dateien").upload(path,f,{contentType:f.type||"application/octet-stream"});
    if(r.error){entry.state="fehlgeschlagen";drawUpl();continue}
    var t=title&&fl.length===1?title:f.name;
    if(target==="main"){
      var it=await addItem({sammlung:"dokument",titel:t,inhalt:"Hochgeladen",daten:{gruppe:"Unterlagen",pfad:path}});
      entry.state=it?"abgelegt in Dokumente":"Eintrag fehlgeschlagen";
    }else{
      var b=await sb.from("beitraege").insert({fach:FACH,titel:t,datei_pfad:path}).select().single();
      if(b.error){entry.state="Eintrag fehlgeschlagen"}else{beitr.unshift(b.data);entry.state="abgelegt in Beiträge"}
    }
    drawUpl();
  }
  renderDocs();$("#utt").value="";
}
function drawUpl(){$("#ul").innerHTML=upl.length?upl.map(function(u){return '<div class="row"><div class="t">'+esc(u.name)+'</div><div class="d">'+esc(u.state)+'</div></div>'}).join(""):'<p class="muted">Noch nichts hochgeladen.</p>'}
var dz=$("#drop"),fi=$("#fi");
dz.addEventListener("click",function(){fi.click()});
dz.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();fi.click()}});
fi.addEventListener("change",function(){if(fi.files.length)addFiles(Array.prototype.slice.call(fi.files));fi.value=""});
["dragenter","dragover"].forEach(function(n){dz.addEventListener(n,function(e){e.preventDefault();dz.classList.add("over")})});
["dragleave","drop"].forEach(function(n){dz.addEventListener(n,function(e){e.preventDefault();dz.classList.remove("over")})});
dz.addEventListener("drop",function(e){if(e.dataTransfer&&e.dataTransfer.files.length)addFiles(Array.prototype.slice.call(e.dataTransfer.files))});

/* ---------- Statische Teile ---------- */
function rqd(){
  var v1=+$("#q1").value,v2=+$("#q2").value,v3=+$("#q3").value;
  $("#q1v").textContent=(v1>0?"+":"")+nf(v1)+" %";$("#q2v").textContent=nf(v2,1)+" %";$("#q3v").textContent=(v3>0?"+":"")+nf(v3)+" %";
  var d=100*(1+v1/100),cap=v2/100,cost=2000*(1+v3/100);
  var rs=2*d-100,ps=rs/cap,rl=cost*cap,sl=2*d-rl;
  $("#qt").innerHTML='<tr><td>Vorher</td><td>100</td><td>2.000</td><td>100</td></tr><tr><td>Kurzfristig</td><td>'+nf(rs)+'</td><td>'+nf(ps)+'</td><td>100</td></tr><tr><td>Langfristig</td><td>'+nf(rl)+'</td><td>'+nf(cost)+'</td><td>'+nf(sl)+'</td></tr>';
  var t;
  if(Math.abs(ps-cost)<1)t="Preis und Baukosten sind gleich. Der Markt ist im Gleichgewicht, es ändert sich nichts.";
  else if(ps>cost)t="Kurzfristig liegt der Preis über den Baukosten. Neubau lohnt sich, der Bestand wächst, bis die Miete sinkt und der Preis die Baukosten erreicht.";
  else t="Kurzfristig liegt der Preis unter den Baukosten. Neubau stoppt, der Bestand schrumpft durch Abgang, bis Miete und Preis wieder steigen.";
  $("#qx").textContent=t;
}
["q1","q2","q3"].forEach(function(id){$("#"+id).addEventListener("input",rqd)});
function rr(){
  var m=+$("#r1").value||0,p=+$("#r2").value||1,c=m/p*100;$("#rc").textContent=nf(c,2)+" %";
  var nc=+$("#r3").value;$("#r3v").textContent=nf(nc,1)+" %";
  var np=m/(nc/100),ch=(np/p-1)*100;$("#rp").textContent=nf(np);$("#rd").textContent=(ch>0?"+":"−")+nf(Math.abs(ch),1)+" %";
  $("#rt").textContent=ch<0?"Die Miete bleibt gleich, der Preis fällt, weil Anleger eine höhere Rendite verlangen.":ch>0?"Die Miete bleibt gleich, der Preis steigt, weil Anleger eine niedrigere Rendite akzeptieren.":"Keine Veränderung.";
  $("#rtab").innerHTML='<tr><td>Vorher</td><td>'+nf(m)+'</td><td>'+nf(c,2)+' %</td><td>'+nf(p)+'</td></tr><tr><td>Nachher</td><td>'+nf(m)+'</td><td>'+nf(nc,2)+' %</td><td>'+nf(np)+'</td></tr>';
}
["r1","r2","r3"].forEach(function(id){$("#"+id).addEventListener("input",rr)});
var FP=[["Project","p1"],["People","p2"],["Prospects","p3"],["Process","p4"],["Panorama","p5"]];
function rfp(){$("#fpv").innerHTML=FP.map(function(p){var v=$("#"+p[1]).value.trim();return '<div class="card"><h3>'+p[0]+'</h3><p class="'+(v?'':'muted ')+'small" style="margin-top:6px;white-space:pre-wrap">'+(v?esc(v):'Noch leer')+'</p></div>'}).join("")}
FP.forEach(function(p){$("#"+p[1]).addEventListener("input",function(){var o=pget("fp",{});o[p[1]]=this.value;pset("fp",o);rfp()})});
$("#l-karte").innerHTML='<div style="overflow-x:auto"><svg viewBox="0 0 640 300" width="640" style="max-width:none;min-width:560px" role="img" aria-label="Zusammenhang der Begriffe"><defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--muted)"/></marker></defs>'+
'<rect class="nd" x="20" y="24" width="130" height="44" rx="12"/><text x="85" y="51" text-anchor="middle">Zinsen</text>'+
'<rect class="nd" x="190" y="24" width="130" height="44" rx="12"/><text x="255" y="51" text-anchor="middle">Cap Rate</text>'+
'<rect class="nd" x="360" y="24" width="130" height="44" rx="12"/><text x="425" y="51" text-anchor="middle">Preis</text>'+
'<rect class="nd" x="360" y="130" width="130" height="44" rx="12"/><text x="425" y="157" text-anchor="middle">Neubau</text>'+
'<rect class="nd" x="360" y="236" width="130" height="44" rx="12"/><text x="425" y="263" text-anchor="middle">Bestand</text>'+
'<rect class="nd" x="190" y="236" width="130" height="44" rx="12"/><text x="255" y="263" text-anchor="middle">Miete</text>'+
'<rect class="nd" x="505" y="130" width="120" height="44" rx="12"/><text x="565" y="157" text-anchor="middle">Zonierung</text>'+
'<rect class="nd" x="20" y="236" width="130" height="44" rx="12"/><text x="85" y="263" text-anchor="middle">Nachfrage</text>'+
'<path class="ln" marker-end="url(#ar)" d="M150 46H188"/><path class="ln" marker-end="url(#ar)" d="M320 46H358"/><path class="ln" marker-end="url(#ar)" d="M425 68V128"/><path class="ln" marker-end="url(#ar)" d="M425 174V234"/><path class="ln" marker-end="url(#ar)" d="M360 258H322"/><path class="ln" marker-end="url(#ar)" d="M150 258H188"/><path class="ln" marker-end="url(#ar)" d="M255 236V70"/><path class="ln" marker-end="url(#ar)" d="M505 152H492"/>'+
'<text class="m" x="436" y="104">Preis über Baukosten</text><text class="m" x="436" y="210">mehr Fläche</text><text class="m" x="262" y="150">Miete bestimmt den Preis</text></svg></div>';

var inited=false;
function initStatic(){
  if(inited)return;inited=true;
  rqd();rr();
  var fp=pget("fp",{});FP.forEach(function(p){$("#"+p[1]).value=fp[p[1]]||""});rfp();
  $("#un").value=pget("notiz","");
}

/* ---------- Navigation ---------- */
$("#tabs").innerHTML=TABS.map(function(t,i){return '<button class="tab" role="tab" data-go="'+t[0]+'" aria-selected="'+(i===0?'true':'false')+'">'+t[1]+'</button>'}).join("");
function go(k){
  if(k!=="suche"&&!TABS.some(function(t){return t[0]===k}))k="uebersicht";
  $$("[data-p]").forEach(function(s){if(s.tagName==="SECTION")s.hidden=(s.dataset.p!==k)});
  $$("#tabs .tab").forEach(function(b){b.setAttribute("aria-selected",b.dataset.go===k?"true":"false")});
  try{history.replaceState(null,"","#"+k)}catch(e){}
  window.scrollTo(0,0);
}
document.addEventListener("click",function(e){var g=e.target.closest("[data-go]");if(g)go(g.dataset.go)});

function renderAll(){renderOv();renderCal();renderTasks();renderReady();ra();rq();renderDocs();renderLernen();ru()}

/* ---------- Start ---------- */
if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})})}
sb.auth.onAuthStateChange(function(ev){if(ev==="SIGNED_OUT"&&me)location.reload()});
boot();
})();
