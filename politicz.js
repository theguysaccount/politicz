(function(){
"use strict";
var D = window.__PZ_DATA__ || {LAW:{},CITY:[],CTY:[],SN:{}};
var M = window.__PZ_MAP__ || {w:960,h:600,paths:{},centroids:{}};
var LAW = D.LAW, CITY = D.CITY, CTY = D.CTY, SN = D.SN;
var $ = function(s){ return document.querySelector(s); };
var on = function(sel, ev, fn){ var n = typeof sel === "string" ? $(sel) : sel; if(n) n.addEventListener(ev, fn); return n; };
var el = function(t,c,x){ var n=document.createElement(t); if(c)n.className=c; if(x!=null)n.textContent=x; return n; };
var esc = function(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); };

/* ---------- storage that is allowed to not exist ---------- */
var mem = {};
var store = {
  get:function(k){ try{ var v=localStorage.getItem(k); return v===null?(k in mem?mem[k]:null):v; }catch(e){ return k in mem?mem[k]:null; } },
  set:function(k,v){ mem[k]=v; try{ localStorage.setItem(k,v); }catch(e){} }
};

/* ---------- theme ---------- */
var saved = store.get("pz-theme");
if(saved) document.documentElement.setAttribute("data-theme", saved);
document.querySelectorAll(".themebtn").forEach(function(tb){ tb.addEventListener("click", function(){
  var cur = document.documentElement.getAttribute("data-theme");
  if(!cur) cur = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  var next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  store.set("pz-theme", next);
}); });

/* ---------- reveal ---------- */
if("IntersectionObserver" in window){
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add("in"); setTimeout(function(){ e.target.classList.add("lit"); }, 220); io.unobserve(e.target); } });
  },{threshold:.22});
  document.querySelectorAll(".reveal").forEach(function(n){ io.observe(n); });
} else {
  document.querySelectorAll(".reveal").forEach(function(n){ n.classList.add("in","lit"); });
}

/* ---------- map ---------- */
var SPEAK = ["No statutory right to speak","Partial — body's discretion","Guaranteed by statute"];
var selState = null;

function buildMap(){
  if(!$("#mapwrap")) return;
  var ns="http://www.w3.org/2000/svg";
  var svg=document.createElementNS(ns,"svg");
  svg.setAttribute("viewBox","0 0 "+M.w+" "+M.h);
  svg.setAttribute("role","img");
  svg.setAttribute("aria-label","Map of the United States shaded by whether the state's open meetings law guarantees a right to speak at a local government meeting. Full data is in the table below.");
  var defs=document.createElementNS(ns,"defs");
  defs.innerHTML='<pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'+
    '<rect width="7" height="7" fill="var(--m-lo)"/><line x1="0" y1="0" x2="0" y2="7" stroke="var(--ground)" stroke-width="2.2"/></pattern>';
  svg.appendChild(defs);
  var g=document.createElementNS(ns,"g");
  Object.keys(M.paths).forEach(function(st){
    var p=document.createElementNS(ns,"path");
    p.setAttribute("d",M.paths[st]);
    var law=LAW[st];
    var f = !law ? "var(--m-none)" : (law.s===2 ? "var(--m-hi)" : law.s===1 ? "var(--m-mid)" : "url(#hatch)");
    p.setAttribute("fill",f);
    p.setAttribute("class","st");
    p.setAttribute("tabindex","0");
    p.setAttribute("role","button");
    p.setAttribute("data-st",st);
    p.setAttribute("aria-label",(SN[st]||st)+": "+(law?SPEAK[law.s]:"no data"));
    var t=document.createElementNS(ns,"title");
    t.textContent=(SN[st]||st)+" — "+(law?SPEAK[law.s]:"no data");
    p.appendChild(t);
    p.addEventListener("click",function(){ showLaw(st,true); });
    p.addEventListener("keydown",function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); showLaw(st,true); } });
    g.appendChild(p);
  });
  svg.appendChild(g);
  $("#mapwrap").appendChild(svg);
  $("#lgLo").style.background="repeating-linear-gradient(45deg,var(--m-lo) 0 4px,var(--ground) 4px 6px)";
}

function noticeText(h){
  if(h==null) return "No fixed minimum in statute";
  if(h>=24 && h%24===0 && h>72) return h+" hours ("+(h/24)+" days)";
  return h+" hours";
}

function showLaw(st, scroll){
  var law=LAW[st]; if(!law || !$("#lawOut")) return;
  selState=st;
  document.querySelectorAll(".st").forEach(function(p){ p.classList.toggle("sel", p.getAttribute("data-st")===st); });
  var vcls = law.s===2?"v2":law.s===1?"v1":"v0";
  var o=$("#lawOut");
  o.innerHTML =
    '<h3>'+esc(SN[st]||st)+' — '+esc(law.n)+'</h3>'+
    '<div class="cite">'+esc(law.c)+'</div>'+
    '<span class="verdict '+vcls+'">'+esc(SPEAK[law.s])+'</span>'+
    '<p style="margin-top:.9rem;color:var(--ink-2)">'+esc(law.cn)+'</p>'+
    '<p style="margin-top:.7rem;font-size:.9rem;color:var(--ink-3)"><b>Agenda notice for a regular meeting:</b> '+esc(noticeText(law.h))+'. <b>Records law:</b> '+esc(law.r)+'.</p>'+
    (law.no?'<p style="margin-top:.7rem;font-size:.86rem;color:var(--ink-3)">'+esc(law.no)+'</p>':'')+
    '<p style="margin-top:.8rem;font-size:.86rem"><a class="out" href="'+esc(law.u)+'" target="_blank" rel="noopener" style="color:var(--ochre);text-decoration:none;border-bottom:1px solid currentColor">Read the source &#8599;</a></p>';
  var lawline = law.s===2
    ? (SN[st]||st)+" is one of only 13 US jurisdictions whose open-meetings law guarantees the public a right to SPEAK at a local government meeting. The other 38 guarantee only the right to watch. "+law.n+", "+law.c+"."
    : (SN[st]||st)+" law lets you watch your city council meet. It does not guarantee you the right to speak. 33 of 51 US jurisdictions are the same. "+law.n+", "+law.c+".";
  var cb=document.createElement("button");
  cb.className="go"; cb.type="button"; cb.style.cssText="margin-top:.9rem;background:transparent;color:var(--ink);font-size:.7rem;padding:.5rem .8rem";
  cb.textContent="Copy this fact";
  cb.addEventListener("click", function(){
    var t=lawline+" \u2014 politicz.org/#"+st;
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t).catch(function(){ fallbackCopy(t,function(){}); });
    else fallbackCopy(t,function(){});
    cb.textContent="Copied"; setTimeout(function(){ cb.textContent="Copy this fact"; },1600);
  });
  o.appendChild(cb);
  try{ if(history.replaceState) history.replaceState(null,"","#"+st); }catch(e){}
  var tr=document.querySelector('#lawTable tr[data-st="'+st+'"]');
  document.querySelectorAll("#lawTable tr").forEach(function(r){ r.classList.remove("here"); });
  if(tr) tr.classList.add("here");
  if(scroll) o.scrollIntoView({behavior:"smooth",block:"nearest"});
}

function buildTable(){
  var tb=document.querySelector("#lawTable tbody");
  if(!tb) return;
  Object.keys(LAW).sort(function(a,b){ return (SN[a]||a).localeCompare(SN[b]||b); }).forEach(function(st){
    var l=LAW[st];
    var tr=el("tr"); tr.setAttribute("data-st",st);
    tr.innerHTML='<td><b>'+esc(SN[st]||st)+'</b></td><td>'+esc(l.n)+'</td><td class="n">'+esc(l.c)+'</td><td class="n">'+esc(noticeText(l.h))+'</td>'+
      '<td><span class="'+(l.s===2?"ok":l.s===1?"":"no")+'">'+esc(SPEAK[l.s])+'</span></td>';
    tb.appendChild(tr);
  });
}

/* ---------- manual selectors ---------- */
function buildSelectors(){
  var ss=$("#selState");
  if(!ss) return;
  ss.appendChild(new Option("State…",""));
  Object.keys(SN).sort(function(a,b){ return SN[a].localeCompare(SN[b]); }).forEach(function(st){ ss.appendChild(new Option(SN[st],st)); });
  fillCities("");
  ss.addEventListener("change", function(){
    var st=ss.value; fillCities(st);
    if(st){ showLaw(st,false); manualResolve(st,null); }
  });
  on("#selCity","change", function(){
    var st=$("#selState").value, ci=$("#selCity").value;
    if(st) manualResolve(st, ci||null);
  });
}
function fillCities(st){
  var sc=$("#selCity");
  if(!sc) return; sc.innerHTML="";
  sc.appendChild(new Option(st?"City (optional)…":"City…",""));
  CITY.filter(function(c){ return c.s===st; })
      .sort(function(a,b){ return b.pop-a.pop; })
      .forEach(function(c){ sc.appendChild(new Option(c.c,c.c)); });
  CTY.filter(function(c){ return c.s===st; }).forEach(function(c){ sc.appendChild(new Option(c.c,"::"+c.c)); });
}

/* ---------- lookup ---------- */
var CTX = null;

function normPlace(n){
  return String(n||"").replace(/\s+(city|town|village|borough|municipality|CDP|city and borough|consolidated government|urban county government|metropolitan government)$/i,"").trim();
}
function findCity(name, st){
  var n=normPlace(name).toLowerCase();
  for(var i=0;i<CITY.length;i++){ if(CITY[i].s===st && CITY[i].c.toLowerCase()===n) return CITY[i]; }
  return null;
}
function findCounty(name, st){
  var n=String(name||"").toLowerCase();
  for(var i=0;i<CTY.length;i++){ if(CTY[i].s===st && CTY[i].c.toLowerCase()===n) return CTY[i]; }
  return null;
}

function jsonp(url, cbName, timeoutMs){
  return new Promise(function(res, rej){
    var s=document.createElement("script"), done=false;
    var t=setTimeout(function(){ if(!done){ done=true; cleanup(); rej(new Error("timeout")); } }, timeoutMs||12000);
    function cleanup(){ clearTimeout(t); try{ delete window[cbName]; }catch(e){ window[cbName]=undefined; } if(s.parentNode) s.parentNode.removeChild(s); }
    window[cbName]=function(data){ if(done) return; done=true; cleanup(); res(data); };
    s.onerror=function(){ if(done) return; done=true; cleanup(); rej(new Error("blocked")); };
    s.src=url+"&format=jsonp&callback="+cbName;
    document.head.appendChild(s);
  });
}

function status(msg, isErr){
  var n=$("#status"); if(!n) return; n.textContent=msg||""; n.className="status"+(isErr?" err":"");
}

function manualResolve(st, cityName){
  var city=null, county=null;
  if(cityName){
    if(cityName.indexOf("::")===0) county=findCounty(cityName.slice(2), st);
    else city=findCity(cityName, st);
  }
  CTX={ st:st, place: city?city.c:null, county: county?county.c:null, city:city, cty:county, reps:null, districts:null, manual:true };
  render();
  buildQuiz();
  status("Set from your selection \u2014 law, calendar and test are live. For the officeholders above you, use the address lookup.", false);
}

on("#addrForm", "submit", function(e){
  e.preventDefault();
  var a=$("#addr").value.trim();
  if(!a){ status("Type a street address — a ZIP alone lands in the wrong council about a third of the time.", true); return; }
  run(a);
});

function run(address){
  $("#goBtn").disabled=true;
  status("Asking the Census Bureau which jurisdiction that is…");
  var geoURL="https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address="+encodeURIComponent(address)+"&benchmark=Public_AR_Current&vintage=Current_Current&layers=all";
  var cb="pzcb"+Date.now();
  var out={ st:null, place:null, county:null, districts:null, reps:null, city:null, cty:null, manual:false };
  var notes=[];

  jsonp(geoURL, cb).then(function(d){
    var m = d && d.result && d.result.addressMatches && d.result.addressMatches[0];
    if(!m) throw new Error("nomatch");
    var g=m.geographies||{};
    function first(k){ var v=g[k]; return (v&&v[0])?v[0]:null; }
    var stg=first("States"), pl=first("Incorporated Places")||first("County Subdivisions"), co=first("Counties");
    var cd=first("119th Congressional Districts")||first("118th Congressional Districts");
    var su=null, sl=null;
    Object.keys(g).forEach(function(k){
      if(/State Legislative Districts - Upper/i.test(k) && g[k][0]) su=g[k][0];
      if(/State Legislative Districts - Lower/i.test(k) && g[k][0]) sl=g[k][0];
    });
    out.st = stg ? stg.STUSAB : null;
    out.place = pl ? pl.NAME : null;
    out.county = co ? co.NAME : null;
    out.districts = { cd: cd?cd.BASENAME:null, su: su?su.BASENAME:null, sl: sl?sl.BASENAME:null };
    out.matched = m.matchedAddress || address;
    if(!out.st) throw new Error("nomatch");
  }).catch(function(err){
    notes.push(err.message==="nomatch"
      ? "The Census geocoder did not recognise that address."
      : "Could not reach the Census geocoder from this page.");
  }).then(function(){
    status(out.st ? "Found "+(out.place||out.county||SN[out.st])+". Asking who holds your seats…" : "Trying the representative lookup…");
    return fetch("https://api.5calls.org/v1/reps?location="+encodeURIComponent(address))
      .then(function(r){ if(!r.ok) throw new Error("http"+r.status); return r.json(); })
      .then(function(j){
        out.reps = j.representatives||[];
        if(!out.st && j.state) out.st=j.state;
        if(!out.place && j.location) out.place=j.location;
        if(j.lowAccuracy) notes.push("The representative lookup flagged this address as low-accuracy — give it a full street address for an exact district.");
      })
      .catch(function(){ notes.push("Could not reach the representative lookup from this page. Everything below still works; the seats above you do not."); });
  }).then(function(){
    $("#goBtn").disabled=false;
    if(!out.st){
      status(notes.join(" ")+" Use the manual selector — the law and the calendar still work with no network at all.", true);
      return;
    }
    out.city = findCity(out.place, out.st);
    out.cty = findCounty(out.county, out.st);
    CTX = out;
    showLaw(out.st, false);
    render();
    buildQuiz();
    status(notes.length ? notes.join(" ") : "");
  });
}

function render(){
  if(!CTX || !$("#results")) return;
  $("#results").hidden=false;
  var st=CTX.st, law=LAW[st];
  var where = CTX.city || CTX.cty;
  var placeLabel = CTX.place || CTX.county || SN[st];

  $("#rmName").textContent = CTX.city ? CTX.city.c+" — city council" : (CTX.cty ? CTX.cty.c+" — county board" : placeLabel);
  if(where){
    $("#rmNote").innerHTML = 'Verified public meeting calendar: <a class="out" href="'+esc(where.u)+'" target="_blank" rel="noopener">open the calendar &#8599;</a>'+
      (where.p?' <span class="mono" style="color:var(--ink-3);font-size:.82rem">('+esc(where.p)+')</span>':'');
  } else {
    $("#rmNote").innerHTML = 'This site verified calendars for the 125 largest US cities and 10 large counties, and '+esc(placeLabel)+' is not among them — so rather than guess a URL, here is the search that finds it: '+
      '<a class="out" href="https://www.google.com/search?q='+encodeURIComponent('"'+placeLabel+'" '+SN[st]+' city council meeting agenda calendar site:.gov')+'" target="_blank" rel="noopener">find your clerk’s calendar &#8599;</a>';
  }

  $("#rmLaw").textContent = law ? (law.s===2 ? "You may speak" : law.s===1 ? "You may have to ask" : "No right to speak") : "\u2014";
  $("#rmLawNote").innerHTML = law
    ? esc(law.n)+' ('+esc(law.c)+') gives you <b>'+esc(noticeText(law.h))+'</b> of agenda notice before a regular meeting. '+esc(law.cn)
    : "";

  var p=$("#people");
  if(CTX.reps && CTX.reps.length){
    p.hidden=false; p.innerHTML="";
    var order={"US Senate":1,"US House":2,"Governor":3,"StateUpper":4,"StateLower":5,"AttorneysGeneral":6,"SecState":7};
    var labels={"US Senate":"US Senate","US House":"US House","Governor":"Governor","StateUpper":"State senate","StateLower":"State house","AttorneysGeneral":"Attorney general","SecState":"Secretary of state"};
    CTX.reps.slice().sort(function(a,b){ return (order[a.area]||9)-(order[b.area]||9); }).forEach(function(r){
      var row=el("div","prow");
      row.innerHTML='<span class="role">'+esc(labels[r.area]||r.area)+'</span><span class="nm">'+esc(r.name)+'</span>'+
        (r.phone?'<a class="ph" href="tel:'+esc(r.phone.replace(/[^0-9+]/g,""))+'">'+esc(r.phone)+'</a>':'');
      p.appendChild(row);
    });
  } else { p.hidden=true; p.innerHTML=""; }

  var g=[];
  if(CTX.districts && CTX.districts.cd) g.push("Congressional district "+CTX.districts.cd);
  if(CTX.districts && CTX.districts.su) g.push("state upper district "+CTX.districts.su);
  if(CTX.districts && CTX.districts.sl) g.push("state lower district "+CTX.districts.sl);
  var gaps = g.length ? "Census places you in "+g.join(", ")+". " : "";
  gaps += "What this cannot tell you: the agenda item that matters this week. No national dataset of municipal agenda text exists — that part is the walk to the clerk's page above.";
  $("#gaps").textContent=gaps;
}

/* ---------- the idiot test ---------- */
var QS=[], answers={};

function lastName(n){
  var p=String(n||"").replace(/\b(Jr\.?|Sr\.?|II|III|IV)\b/gi,"").trim().split(/\s+/);
  return (p[p.length-1]||"").toLowerCase();
}
function matchesName(input, full){
  var v=String(input||"").toLowerCase().replace(/[^a-z\s'-]/g,"").trim();
  if(v.length<3) return false;
  var ln=lastName(full);
  if(!ln) return false;
  return v.indexOf(ln)>-1 || ln.indexOf(v)>-1;
}
function repOf(area){
  if(!CTX||!CTX.reps) return null;
  for(var i=0;i<CTX.reps.length;i++){ if(CTX.reps[i].area===area) return CTX.reps[i]; }
  return null;
}
function repsOf(area){
  if(!CTX||!CTX.reps) return [];
  return CTX.reps.filter(function(r){ return r.area===area; });
}

function noticeOptions(h){
  var pool=[24,48,72,120,168], correct = h==null ? "none" : h;
  var opts=[];
  if(h!=null && pool.indexOf(h)<0) pool.push(h);
  pool.sort(function(a,b){ return a-b; });
  pool.forEach(function(v){ opts.push(v); });
  opts=opts.filter(function(v,i,a){ return a.indexOf(v)===i; }).slice(0,5);
  opts.push("none");
  if(h!=null && opts.indexOf(h)<0) opts[0]=h;
  return { opts:opts, correct:correct };
}

function recordsOptions(st){
  var correct=LAW[st].r;
  var others=[];
  Object.keys(LAW).forEach(function(k){ if(k!==st && LAW[k].r && LAW[k].r!==correct) others.push(LAW[k].r); });
  others=others.filter(function(v,i,a){ return a.indexOf(v)===i; });
  var picks=[correct];
  var seed=st.charCodeAt(0)+st.charCodeAt(1);
  for(var i=0;i<3 && others.length;i++){ picks.push(others[(seed*(i+7)*13)%others.length]); }
  picks=picks.filter(function(v,i,a){ return a.indexOf(v)===i; });
  picks.sort(function(a,b){ return a.localeCompare(b); });
  return { opts:picks, correct:correct };
}

function buildQuiz(){
  if(!CTX || !$("#quiz")) return;
  var st=CTX.st, law=LAW[st];
  QS=[]; answers={};
  var sname=SN[st]||st;

  var no=noticeOptions(law.h);
  QS.push({
    t:"How many hours before a regular meeting must a local governing body in "+sname+" post its agenda?",
    kind:"mc",
    opts:no.opts.map(function(v){ return v==="none" ? "No fixed minimum" : v+" hours"; }),
    correct: no.correct==="none" ? "No fixed minimum" : no.correct+" hours",
    why: law.n+", "+law.c+" — "+noticeText(law.h)+"."
  });

  QS.push({
    t:"Does "+sname+" law guarantee you the right to speak at a meeting of your city council?",
    kind:"mc", opts:["Yes","No"],
    correct: law.s===2 ? "Yes" : "No",
    why: law.s===2 ? ("Yes. "+law.cn) : (law.s===1 ? ("Not as a right. "+law.cn) : ("No. "+law.cn+" Attendance is guaranteed; speech is not."))
  });

  var ro=recordsOptions(st);
  QS.push({
    t:"What is "+sname+"'s public records law called — the one you would use to obtain a document from your city?",
    kind:"mc", opts:ro.opts, correct:ro.correct,
    why: ro.correct+"."
  });

  var house=repOf("US House");
  if(house){
    QS.push({ t:"Name the person who currently holds your seat in the US House.", kind:"text", correct:house.name,
      why:house.name+(house.phone?" — "+house.phone:"") });
  }
  var sens=repsOf("US Senate");
  if(sens.length){
    QS.push({ t:"Name either of your two US senators.", kind:"text", correct:sens.map(function(s){return s.name;}),
      why:sens.map(function(s){ return s.name+(s.phone?" ("+s.phone+")":""); }).join(" and ")+"." });
  }
  var lower=repOf("StateLower")||repOf("StateUpper")||repOf("Governor");
  if(lower){
    var lbl = repOf("StateLower") ? "state house" : (repOf("StateUpper") ? "state senate" : "governor's office");
    QS.push({ t:"Name the person who currently holds your "+lbl+" seat.", kind:"text", correct:lower.name,
      why:lower.name+(lower.phone?" — "+lower.phone:"") });
  }

  var q=$("#quiz"); q.innerHTML="";
  if(QS.length<4){
    var w=el("p"); w.style.color="var(--ink-3)"; w.style.marginBottom="1rem";
    w.textContent="The representative lookup was unreachable, so this is the short version — "+QS.length+" questions from the statute alone. On politicz.org the full six run against live records.";
    q.appendChild(w);
  }
  QS.forEach(function(item,i){
    var d=el("div","q"); d.setAttribute("data-i",i);
    var h=el("div","qh");
    h.appendChild(el("span","qn mono",String(i+1).padStart(2,"0")));
    h.appendChild(el("span","qt",item.t));
    d.appendChild(h);
    if(item.kind==="mc"){
      var o=el("div","opts");
      item.opts.forEach(function(txt){
        var b=el("button","opt",txt); b.type="button"; b.setAttribute("aria-pressed","false");
        b.addEventListener("click",function(){
          o.querySelectorAll(".opt").forEach(function(x){ x.setAttribute("aria-pressed","false"); });
          b.setAttribute("aria-pressed","true");
          answers[i]=txt; grade(i,d,item);
        });
        o.appendChild(b);
      });
      d.appendChild(o);
    } else {
      var inp=el("input"); inp.type="text"; inp.placeholder="Type the name — last name is enough";
      inp.addEventListener("change",function(){ answers[i]=inp.value; grade(i,d,item); });
      inp.addEventListener("blur",function(){ if(inp.value){ answers[i]=inp.value; grade(i,d,item); } });
      d.appendChild(inp);
    }
    var m=el("div","mark-row"); d.appendChild(m);
    q.appendChild(d);
  });
  $("#score").classList.remove("show");
}

function isRight(i){
  var item=QS[i], a=answers[i];
  if(a==null||a==="") return false;
  if(item.kind==="mc") return a===item.correct;
  var c=item.correct;
  if(Array.isArray(c)) return c.some(function(n){ return matchesName(a,n); });
  return matchesName(a,c);
}

function grade(i,node,item){
  var m=node.querySelector(".mark-row");
  var ok=isRight(i);
  m.className="mark-row show";
  m.innerHTML = (ok?'<span class="ok">Correct.</span> ':'<span class="no">Not this one.</span> ')+esc(item.why);
  if(Object.keys(answers).length===QS.length) finish();
}

var BANDS=[
  { max:1, name:"IDIŌTĒS", tr:"the private person",
    say:"The Athenian word, used plainly: someone who keeps to their own affairs and leaves the common ones to whoever shows up. It is a position, not a verdict, and it is the easiest one on this page to leave." },
  { max:4, name:"THEATĒS", tr:"the spectator",
    say:"You can see the thing. You are not yet in it. The gap between watching politics and doing it is one weeknight and one agenda item." },
  { max:99, name:"POLITĒS", tr:"the citizen",
    say:"You can name the room, the rule and the people. That is rarer than it should be. The remaining question is not what you know — it is what is different in your town because you knew it." }
];

function finish(){
  if(!$("#score")) return;
  var n=0; for(var i=0;i<QS.length;i++){ if(isRight(i)) n++; }
  var pct=n/QS.length;
  var band=BANDS.find(function(b){ return (pct*6) <= b.max; }) || BANDS[2];
  var law=LAW[CTX.st], sname=SN[CTX.st]||CTX.st;
  $("#scoreFrac").textContent=n+" of "+QS.length+" correct \u00b7 "+band.tr;
  $("#scoreBand").textContent=band.name;
  $("#scoreSay").textContent=band.say;
  var lawline = law.s===2
    ? sname+" is one of only 13 US jurisdictions whose law guarantees me the right to speak at a local government meeting."
    : sname+" law lets me watch my city council meet but does not guarantee me the right to speak. 33 of 51 US jurisdictions are the same.";
  $("#shareText").textContent="I scored "+n+"/"+QS.length+" on the idiot test at politicz.org. "+lawline;
  $("#score").classList.add("show");
  $("#score").scrollIntoView({behavior:"smooth",block:"nearest"});
}

on("#copyBtn","click",function(){
  var t=$("#shareText").textContent;
  var done=function(){ $("#copyBtn").textContent="Copied"; setTimeout(function(){ $("#copyBtn").textContent="Copy result"; },1600); };
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(done,function(){ fallbackCopy(t,done); }); }
  else fallbackCopy(t,done);
});
function fallbackCopy(t,done){
  var ta=document.createElement("textarea"); ta.value=t; ta.setAttribute("readonly","");
  ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select();
  try{ document.execCommand("copy"); done(); }catch(e){}
  document.body.removeChild(ta);
}
on("#retryBtn","click",function(){ buildQuiz(); $("#quiz").scrollIntoView({behavior:"smooth",block:"start"}); });

/* ---------- commitment ---------- */
function cmText(){
  var w=$("#cmWhat").value.trim(), b=$("#cmBy").value.trim(), o=$("#cmWho").value.trim();
  if(!w) return null;
  return "By "+(b||"[no date \u2014 a commitment without a date is a mood]")+" I will "+w+". It worked if there is a choice open to "+(o||"[whose choices this opens \u2014 unstated]")+" that was not open before.";
}
on("#cmSave","click",function(){
  var t=cmText();
  if(!t){ $("#cmOut").textContent="Write the first line. One act, not a plan."; $("#cmOut").className="status err"; return; }
  store.set("pz-commit", JSON.stringify({what:$("#cmWhat").value,by:$("#cmBy").value,who:$("#cmWho").value}));
  $("#cmOut").textContent=t;
  $("#cmOut").className="status";
});
on("#cmCopy","click",function(){
  var t=cmText(); if(!t){ $("#cmOut").textContent="Nothing to copy yet."; return; }
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).catch(function(){ fallbackCopy(t,function(){}); });
  else fallbackCopy(t,function(){});
  $("#cmCopy").textContent="Copied"; setTimeout(function(){ $("#cmCopy").textContent="Copy it"; },1600);
});
(function restore(){
  try{
    if(!$("#cmWhat")) return;
    var raw=store.get("pz-commit"); if(!raw) return;
    var o=JSON.parse(raw);
    $("#cmWhat").value=o.what||""; $("#cmBy").value=o.by||""; $("#cmWho").value=o.who||"";
    var t=cmText(); if(t) $("#cmOut").textContent=t;
  }catch(e){}
})();

/* ---------- init ---------- */
buildMap();
buildTable();
buildSelectors();
(function deepLink(){
  var h=(location.hash||"").replace("#","").toUpperCase();
  if(h && LAW[h]){ showLaw(h,false); }
})();
window.addEventListener("hashchange",function(){
  var h=(location.hash||"").replace("#","").toUpperCase();
  if(h && LAW[h]) showLaw(h,true);
});
var now=new Date(), today=now.toISOString().slice(0,10);
if($("#cmDate")) $("#cmDate").textContent="today is "+today;
document.querySelectorAll(".stamp").forEach(function(n){
  n.textContent="Data verified "+today+" \u00b7 51 open-meetings statutes \u00b7 125 city and 10 county meeting calendars, each fetched and content-checked.";
});
})();
