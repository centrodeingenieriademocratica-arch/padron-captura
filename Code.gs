/* PADRÓN ÚNICO — Servidor v5 (Google Apps Script ligado a la hoja)
   Endpoint público SOLO de captura: login, buscar, guardar.
   Cambios vs v4: (1) fecha de nacimiento y sexo obligatorios para personas nuevas
   (columnas nuevas "nacimiento" y "sexo" al final de Capturas y de Padron; se crean solas);
   (2) el NOMBRE ya no se usa para unir ni comparar registros: el único identificador es el CURP.
   Sin CURP = siempre registro nuevo con folio SC-. Con CURP = se une solo a ese mismo CURP.
   "Revisar" queda solo para apoyo repetido (misma clave, programa y año). NO PROBADO.
   v6 (NO PROBADO): hoja Eventos (las áreas definen cada apoyo; el capturista solo lo elige); colonia, CP, correo e INE reverso.
   v7 (NO PROBADO): los apoyos también se dan de alta desde la app (funciona sin señal); llegan a Eventos. */
const COLS={
 Claves:["id","nombre","municipio","hash","activa"],
 Catalogos:["municipio","tipo","valor"],
 Capturas:["id","ts","capturista","municipio","estado","curp","folio","nombre","localidad","tel","direccion","lat","lng","grupos","programa","eje","area","monto","fecha","fotoBen","fotoApoyo","fotoIne","notas","motivoSinGps","nacimiento","sexo","evento","tipo","canal","colonia","cp","correo","fotoIneReverso"],
 Padron:["clave","curp","folio","nombre","municipio","localidad","tel","direccion","lat","lng","grupos","primera_captura","estado","nacimiento","sexo","colonia","cp","correo"],
 Apoyos:["id","clave","municipio","programa","eje","area","monto","fecha","lat","lng","fotoBen","fotoApoyo","captura","aviso","evento","tipo","canal"],
 /* Cada área da de alta aquí sus apoyos; el capturista solo elige el nombre. Monto vacío = lo escribe el capturista. Fecha vacía = día de la captura. */
 Eventos:["id","municipio","nombre","programa","tipo","eje","area","canal","monto","fecha","activo","creado_por","creado"]
};
/* Deben ser idénticas a las listas de la app. */
const MOTIVOS=["GPS sin señal o no funciona","La persona no permitió tomar la ubicación","Domicilio de difícil acceso","Otro (explicar en Notas)"];
const SEXOS=["Mujer","Hombre"];
const CURP=/^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;
const yr_=x=>x instanceof Date?String(x.getFullYear()):String(x).slice(0,4);
const sh_=n=>SpreadsheetApp.getActive().getSheetByName(n);
const P_=()=>PropertiesService.getScriptProperties();

function onOpen(){SpreadsheetApp.getUi().createMenu("Padrón")
 .addItem("1. Instalar (una sola vez)","instalar").addItem("2. Nueva clave de capturista","nuevaClave").addToUi()}

function instalar(){
 if(!P_().getProperty("SAL"))P_().setProperty("SAL",Utilities.getUuid());
 if(!P_().getProperty("CARPETA"))P_().setProperty("CARPETA",DriveApp.createFolder("Padron-fotos (privada)").getId());
 Object.keys(COLS).forEach(n=>{let s=sh_(n)||SpreadsheetApp.getActive().insertSheet(n);
  if(s.getLastRow()==0){s.appendRow(COLS[n]);s.setFrozenRows(1)}});
 const c=sh_("Catalogos");if(c.getLastRow()==1)c.getRange(2,1,3,3).setValues([["*","grupo","Adulto mayor"],["*","grupo","Persona con discapacidad"],["*","localidad","Localidad ejemplo (borrar o editar)"]]);
 const ev=sh_("Eventos");if(ev.getLastRow()==1)ev.appendRow(["E1","*","Apoyo ejemplo (borrar o editar)","Programa ejemplo","Despensa","","DIF municipal","Visita domiciliaria","","","SI"]);
 SpreadsheetApp.getUi().alert("Listo. En Catalogos escriba localidades y grupos. En Eventos cada área da de alta sus apoyos (un id distinto por fila). Use * en municipio para que aplique a todos.")}

/* Completa encabezados de columnas nuevas en hojas creadas con versiones anteriores. */
function cab_(n){const s=sh_(n),c=COLS[n],h=s.getRange(1,1,1,c.length).getValues()[0];
 c.forEach((x,i)=>{if(h[i]===""||h[i]===undefined)s.getRange(1,i+1).setValue(x)})}

function hash_(c){return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,P_().getProperty("SAL")+String(c).trim().toUpperCase()))}
function quien_(c){if(!c)return null;const h=hash_(c),v=sh_("Claves").getDataRange().getValues();
 for(let i=1;i<v.length;i++)if(v[i][3]===h&&String(v[i][4]).toUpperCase()==="SI")return{id:v[i][0],nombre:v[i][1],mun:v[i][2]};return null}

function nuevaClave(){const u=SpreadsheetApp.getUi();
 const a=u.prompt("Nombre del capturista");if(a.getSelectedButton()!=u.Button.OK)return;
 const b=u.prompt("Municipio (escríbalo igual en todas las claves y catálogos)");if(b.getSelectedButton()!=u.Button.OK)return;
 const al="ABCDEFGHJKMNPQRSTUVWXYZ23456789";let k="";for(let i=0;i<10;i++)k+=al[Math.floor(Math.random()*al.length)];
 sh_("Claves").appendRow([Utilities.getUuid().slice(0,8),a.getResponseText().trim(),b.getResponseText().trim(),hash_(k),"SI"]);
 u.alert("Clave de "+a.getResponseText()+": "+k+"\n\nEntréguela en persona. No se vuelve a mostrar. Para darla de baja, escriba NO en la columna activa de la hoja Claves.")}

function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
function doGet(){return json_({ok:true,servicio:"padron-captura"})}

function doPost(e){
 try{const d=JSON.parse(e.postData.contents),q=quien_(d.clave);
  if(!q)return json_({ok:false,error:"clave"});
  if(d.a==="login")return json_({ok:true,nombre:q.nombre,mun:q.mun,cat:catalogo_(q.mun)});
  if(d.a==="buscar")return json_(buscar_(q,d.curp));
  if(d.a==="guardar")return json_(guardar_(q,d.reg||{}));
  return json_({ok:false,error:"accion"})}
 catch(err){return json_({ok:false,error:"servidor"})}}

/* Solo devuelve el NOMBRE de quien ya está en el padrón con ese CURP y en el municipio del capturista. */
function buscar_(q,curp){curp=String(curp||"").toUpperCase().trim();
 if(!CURP.test(curp))return{ok:false,error:"datos"};
 const pd=sh_("Padron");if(pd.getLastRow()<2)return{ok:true,existe:false};
 const f=pd.getRange(2,1,pd.getLastRow()-1,5).getValues().find(x=>x[0]===curp&&x[4]===q.mun);
 return f?{ok:true,existe:true,nombre:String(f[3])}:{ok:true,existe:false}}

function catalogo_(mun){const o={localidad:[],grupo:[],evento:[]},v=sh_("Catalogos").getDataRange().getValues();
 for(let i=1;i<v.length;i++)if((v[i][0]==="*"||v[i][0]===mun)&&o[v[i][1]])o[v[i][1]].push(v[i][2]);
 eventos_(mun).filter(e=>String(e[10]).toUpperCase()!=="NO").forEach(e=>o.evento.push({id:String(e[0]),n:String(e[2]),programa:String(e[3]),tipo:String(e[4]),
  eje:String(e[5]),area:String(e[6]),canal:String(e[7]),monto:e[8]===""?"":Number(e[8]),fecha:e[9] instanceof Date?Utilities.formatDate(e[9],"America/Mexico_City","yyyy-MM-dd"):String(e[9])}));return o}

/* Alta de un apoyo desde la app. Si ya existe ese id no hace nada (reenvíos). */
function crearEv_(q,v){v=v||{};const t=x=>String(x==null?"":x).trim().slice(0,200),id=t(v.id),n=t(v.n),mo=v.monto===""||v.monto==null?"":Number(v.monto),fe=t(v.fecha);
 if(!/^EV-[A-Z0-9]{4,20}$/.test(id)||!n||(mo!==""&&!(mo>=0))||(fe&&!/^\d{4}-\d{2}-\d{2}$/.test(fe)))return false;
 const L=LockService.getScriptLock();L.waitLock(25000);
 try{let s=sh_("Eventos");if(!s){s=SpreadsheetApp.getActive().insertSheet("Eventos");s.appendRow(COLS.Eventos);s.setFrozenRows(1)}cab_("Eventos");
  if(!eventos_(q.mun).some(e=>String(e[0])===id))s.appendRow([id,q.mun,n,t(v.programa),t(v.tipo),t(v.eje),t(v.area),t(v.canal),mo,fe,"SI",q.id,new Date()]);return true}
 finally{L.releaseLock()}}
const eventos_=mun=>{const s=sh_("Eventos");return s&&s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,11).getValues().filter(e=>e[0]!==""&&(e[1]==="*"||e[1]===mun)):[]};

function foto_(b64,nombre){if(!b64)return"";const m=String(b64).split(",")[1]||b64;
 return DriveApp.getFolderById(P_().getProperty("CARPETA")).createFile(Utilities.newBlob(Utilities.base64Decode(m),"image/jpeg",nombre+".jpg")).getId()}

function existe_(id){const s=sh_("Capturas");return s.getLastRow()>1&&!!s.getRange(2,1,s.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext()}
function enPadron_(clave){const s=sh_("Padron");return s.getLastRow()>1&&!!s.getRange(2,1,s.getLastRow()-1,1).createTextFinder(clave).matchEntireCell(true).findNext()}

function nacOk_(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const d=new Date(s+"T00:00:00Z");
 return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===s&&s>="1900-01-01"&&s<=Utilities.formatDate(new Date(),"America/Mexico_City","yyyy-MM-dd")}

/* Guarda y procesa en el mismo paso. Estados de la captura:
   Completa (con CURP) | Incompleta (sin CURP, folio SC-) | Revisar (apoyo repetido: misma clave, programa y año).
   El nombre NUNCA se usa para unir ni comparar. */
function guardar_(q,r){
 if(r.tipoReg==="evento"){try{return crearEv_(q,r.ev)?{ok:true}:{ok:false,error:"datos"}}catch(e){return{ok:false,error:"ocupado"}}}
 const curp=String(r.curp||"").toUpperCase().trim();
 const conGps=!!(r.lat&&r.lng),motivo=conGps?"":String(r.sinGps||"").trim();
 if(!r.id||!r.nombre||!r.aviso||(curp&&!CURP.test(curp)))return{ok:false,error:"datos"};
 if(!conGps&&MOTIVOS.indexOf(motivo)<0)return{ok:false,error:"datos"};
 const nac=String(r.nacimiento||"").trim(),sexo=String(r.sexo||"").trim();
 /* Si el CURP ya está en el padrón no se piden otra vez nacimiento ni sexo. */
 if(!(curp&&enPadron_(curp))&&(!nacOk_(nac)||SEXOS.indexOf(sexo)<0))return{ok:false,error:"datos"};
 let ev=null;if(r.evento){const b=()=>eventos_(q.mun).find(e=>String(e[0])===String(r.evento));ev=b();
  /* Apoyo dado de alta en el teléfono que aún no llega: se crea con la definición que trae el registro. */
  if(!ev&&r.ev&&String(r.ev.id)===String(r.evento)){try{if(crearEv_(q,r.ev))ev=b()}catch(e){return{ok:false,error:"ocupado"}}}
  if(!ev)return{ok:false,error:"datos"}}
 if(existe_(r.id))return{ok:true,dup:true};
 const ben=foto_(r.fotoBen,r.id+"_ben"),apo=foto_(r.fotoApoyo,r.id+"_apoyo"),ine=foto_(r.fotoIne,r.id+"_ine"),iner=foto_(r.fotoIneR,r.id+"_ine_reverso");
 const L=LockService.getScriptLock();try{L.waitLock(25000)}catch(e){return{ok:false,error:"ocupado"}}
 try{
 if(existe_(r.id))return{ok:true,dup:true};
 cab_("Capturas");cab_("Padron");cab_("Apoyos");
 /* Los datos del apoyo salen de la hoja Eventos, no del teléfono. */
 if(ev){r.programa=ev[3]||ev[2];r.tipo=ev[4];r.eje=ev[5];r.area=ev[6];r.canal=ev[7];if(ev[8]!=="")r.monto=ev[8];
  r.fecha=ev[9]!==""?ev[9]:Utilities.formatDate(new Date(Number(r.ts)||Date.now()),"America/Mexico_City","yyyy-MM-dd")}
 const ext=[r.colonia||"",r.cp||"",r.correo||""];
 const sc=sh_("Capturas");
 const lat=conGps?r.lat:"",lng=conGps?r.lng:"";
 const mun=q.mun,ts=new Date(),nombre=String(r.nombre).trim(),grupos=(r.grupos||[]).join("; ");
 const pd=sh_("Padron"),claves=pd.getLastRow()>1?pd.getRange(2,1,pd.getLastRow()-1,1).getValues().map(x=>x[0]):[];
 const base=[r.localidad||"",r.tel||"",r.direccion||"",lat,lng,grupos,ts];
 let clave,folio="",estado=curp?"Completa":"Incompleta";
 if(curp){
  clave=curp;
  if(claves.indexOf(curp)<0)pd.appendRow([curp,curp,"",nombre,mun,...base,"Completo",nac,sexo,...ext]);
 }else{
  folio="SC-"+String(r.id).slice(0,8).toUpperCase();clave=folio;
  if(claves.indexOf(folio)<0)pd.appendRow([folio,null,folio,nombre,mun,...base,"Incompleto",nac,sexo,...ext]);
 }
 if(r.programa){const ap=sh_("Apoyos"),av=ap.getLastRow()>1?ap.getRange(2,2,ap.getLastRow()-1,7).getValues():[];
  const k=clave+"|"+String(r.programa).toLowerCase()+"|"+yr_(r.fecha);let aviso="";
  if(av.some(a=>a[0]+"|"+String(a[2]).toLowerCase()+"|"+yr_(a[6])===k)){aviso="Duplicado probable: mismo programa y año";estado="Revisar"}
  ap.appendRow([r.id,clave,mun,r.programa,r.eje||"",r.area||"",r.monto||"",r.fecha||"",lat,lng,ben,apo,r.id,aviso,r.evento||"",r.tipo||"",r.canal||""])
 }
 sc.appendRow([r.id,ts,q.id,mun,estado,curp,folio,nombre,r.localidad||"",r.tel||"",r.direccion||"",lat,lng,grupos,
  r.programa||"",r.eje||"",r.area||"",r.monto||"",r.fecha||"",ben,apo,ine,r.notas||"",motivo,nac,sexo,r.evento||"",r.tipo||"",r.canal||"",...ext,iner]);
 return{ok:true}}
 finally{L.releaseLock()}}
