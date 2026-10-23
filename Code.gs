/* PADRÓN ÚNICO — Servidor v5 (Google Apps Script ligado a la hoja)
   Endpoint público SOLO de captura: login, buscar, guardar.
   Cambios vs v4: (1) fecha de nacimiento y sexo obligatorios para personas nuevas
   (columnas nuevas "nacimiento" y "sexo" al final de Capturas y de Padron; se crean solas);
   (2) el NOMBRE ya no se usa para unir ni comparar registros: el único identificador es el CURP.
   Sin CURP = siempre registro nuevo con folio SC-. Con CURP = se une solo a ese mismo CURP.
   "Revisar" queda solo para apoyo repetido (misma clave, programa y año). NO PROBADO.
   v6 (NO PROBADO): hoja Eventos (las áreas definen cada apoyo; el capturista solo lo elige); colonia, CP, correo e INE reverso.
   v8 (NO PROBADO): menú "3. Importar histórico" para pasar listas de Excel al padrón; "4. Claves en lote"; "5. Actualizar Avance".
   v9 (NO PROBADO): una copia de la plantilla por ayuntamiento (Instalar detecta la copia y crea claves y carpeta propias);
   nombre del ayuntamiento en la app; aviso de privacidad desde Catalogos; Avance diario automático.
   v10 (NO PROBADO): apoyos periódicos: nueva entrega o periodo de un apoyo existente (columnas base y periodo en Eventos);
   otra entrega del mismo apoyo periódico ya no se marca como repetida.
   v7 (NO PROBADO): los apoyos también se dan de alta desde la app (funciona sin señal); llegan a Eventos. */
const COLS={
 Claves:["id","nombre","municipio","hash","activa"],
 Catalogos:["municipio","tipo","valor"],
 Capturas:["id","ts","capturista","municipio","estado","curp","folio","nombre","localidad","tel","direccion","lat","lng","grupos","programa","eje","area","monto","fecha","fotoBen","fotoApoyo","fotoIne","notas","motivoSinGps","nacimiento","sexo","evento","tipo","canal","colonia","cp","correo","fotoIneReverso"],
 Padron:["clave","curp","folio","nombre","municipio","localidad","tel","direccion","lat","lng","grupos","primera_captura","estado","nacimiento","sexo","colonia","cp","correo"],
 Apoyos:["id","clave","municipio","programa","eje","area","monto","fecha","lat","lng","fotoBen","fotoApoyo","captura","aviso","evento","tipo","canal"],
 /* Cada área da de alta aquí sus apoyos; el capturista solo elige el nombre. Monto vacío = lo escribe el capturista. Fecha vacía = día de la captura. */
 Eventos:["id","municipio","nombre","programa","tipo","eje","area","canal","monto","fecha","activo","creado_por","creado","base","periodo"]
};
/* Deben ser idénticas a las listas de la app. */
const MOTIVOS=["GPS sin señal o no funciona","La persona no permitió tomar la ubicación","Domicilio de difícil acceso","Otro (explicar en Notas)"];
const SEXOS=["Mujer","Hombre"];
const CURP=/^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;
const yr_=x=>x instanceof Date?String(x.getFullYear()):String(x).slice(0,4);
const sh_=n=>SpreadsheetApp.getActive().getSheetByName(n);
const P_=()=>PropertiesService.getScriptProperties();

function onOpen(){SpreadsheetApp.getUi().createMenu("Padrón")
 .addItem("1. Instalar (una sola vez)","instalar").addItem("2. Nueva clave de capturista","nuevaClave").addItem("3. Importar histórico (hoja Importar)","importar")
 .addItem("4. Claves en lote (hoja NuevasClaves)","clavesLote").addItem("5. Actualizar Avance","avance").addToUi()}

/* ---- Claves en lote: hoja NuevasClaves con columnas nombre y municipio (fila 1 = encabezados).
   Escribe la clave en la columna C para imprimirla y entregarla; bórrela de ahí después de entregar. ---- */
function clavesLote(){const u=SpreadsheetApp.getUi();let s=sh_("NuevasClaves");
 if(!s){s=SpreadsheetApp.getActive().insertSheet("NuevasClaves");s.appendRow(["nombre","municipio (vacío = el del ayuntamiento)","clave (borrar al entregar)"]);s.setFrozenRows(1);return u.alert("Se creó la hoja NuevasClaves. Escriba un capturista por fila y vuelva a correr este menú.")}
 if(!sh_("Claves"))return u.alert("Primero corra 1. Instalar.");
 const v=s.getDataRange().getValues();let n=0;
 for(let i=1;i<v.length;i++){const nom=String(v[i][0]).trim(),mun=String(v[i][1]).trim()||MUN_();if(!nom||!mun||String(v[i][2]||"")!=="")continue;
  s.getRange(i+1,3).setValue(clave_(nom,mun));n++}
 u.alert(n?"Se crearon "+n+" claves en la columna C. Imprímalas, entréguelas en persona y después borre esa columna. Las claves no se pueden volver a ver.":"No hay filas nuevas (con nombre, municipio y sin clave).")}
function clave_(nom,mun){const al="ABCDEFGHJKMNPQRSTUVWXYZ23456789";let k="";for(let i=0;i<10;i++)k+=al[Math.floor(Math.random()*al.length)];
 sh_("Claves").appendRow([Utilities.getUuid().slice(0,8),nom,mun,hash_(k),"SI"]);return k}

/* ---- Avance: resumen para el informe (por municipio, por capturista y por día). Se recalcula cada vez que se corre. ---- */
function avance(){const A=SpreadsheetApp.getActive(),rows=n=>{const s=sh_(n);return s&&s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,s.getLastColumn()).getValues():[]};
 const pd=rows("Padron"),ap=rows("Apoyos"),sc=rows("Capturas"),cl=rows("Claves"),nomC={};cl.forEach(c=>nomC[c[0]]=c[1]+" ("+c[2]+")");
 const M={},C={},D={},dia=x=>x instanceof Date?Utilities.formatDate(x,"America/Mexico_City","yyyy-MM-dd"):String(x).slice(0,10);
 const m_=k=>M[k]=M[k]||{p:0,inc:0,a:0,mo:0,rev:0,mult:0},yr=String(new Date().getFullYear()),AR={};
 pd.forEach(r=>{const o=m_(r[4]);o.p++;if(String(r[12])==="Incompleto")o.inc++});
 ap.forEach(r=>{const o=m_(r[2]);o.a++;o.mo+=Number(r[6])||0;if(r[13])o.rev++;
  if(yr_(r[7])===yr&&r[5]){const k=r[2]+"|"+r[1];(AR[k]=AR[k]||new Set()).add(String(r[5]).trim().toLowerCase())}});
 Object.keys(AR).forEach(k=>{if(AR[k].size>1)m_(k.split("|")[0]).mult++});
 sc.forEach(r=>{const k=nomC[r[2]]||r[2],c=C[k]=C[k]||{n:0,u:""},d=dia(r[1]);c.n++;if(d>c.u)c.u=d;D[d]=(D[d]||0)+1});
 const E=["","","","","","",""],out=[["Avance actualizado",Utilities.formatDate(new Date(),"America/Mexico_City","yyyy-MM-dd HH:mm"),"","","","",""],E,
  ["Municipio","Personas en padrón","Sin CURP (incompletas)","Apoyos registrados","Monto total ($)","Apoyos repetidos (revisar)","Personas con apoyos de 2 o más áreas en "+yr]];
 Object.keys(M).sort().forEach(k=>out.push([k,M[k].p,M[k].inc,M[k].a,M[k].mo,M[k].rev,M[k].mult]));
 out.push(E,["Capturista","Registros enviados","Último envío","","","",""]);
 Object.keys(C).sort().forEach(k=>out.push([k,C[k].n,C[k].u,"","","",""]));
 out.push(E,["Día","Registros enviados","","","","",""]);
 Object.keys(D).sort().reverse().forEach(k=>out.push([k,D[k],"","","","",""]));
 let s=sh_("Avance")||A.insertSheet("Avance");s.clearContents();s.getRange(1,1,out.length,7).setValues(out);s.autoResizeColumns(1,7);try{A.setActiveSheet(s)}catch(e){}}

/* ---- Importar beneficiarios históricos desde Excel ----
   El administrador importa su Excel a una hoja llamada "Importar" (Archivo → Importar). Fila 1 = encabezados.
   Encabezados que se reconocen (sin importar mayúsculas ni acentos): curp, nombre, nacimiento, sexo, localidad, telefono,
   correo, direccion, colonia, cp, grupos, programa, tipo, eje, area, canal, monto, fecha.
   Se une solo por CURP; sin CURP, cada fila es una persona nueva con folio SC-. Escribe el resultado de cada fila en la
   columna "resultado"; las filas con resultado no se vuelven a procesar, así que se puede correr varias veces. */
const IMP_=["curp","nombre","nacimiento","sexo","localidad","telefono","correo","direccion","colonia","cp","grupos","programa","tipo","eje","area","canal","monto","fecha"];
const norm_=x=>String(x).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z]/g,"");
const fec_=x=>x instanceof Date?Utilities.formatDate(x,"America/Mexico_City","yyyy-MM-dd"):String(x||"").trim();
/* Fecha y sexo desde el CURP: posiciones 5-10 (AAMMDD) y 11 (H/M). El dígito 17 distingue siglo: número = 1900, letra = 2000. */
function deCurp_(c){const a=+c.slice(4,6),s=/\d/.test(c[16])?1900:2000;return{nac:(s+a)+"-"+c.slice(6,8)+"-"+c.slice(8,10),sexo:c[10]==="H"?"Hombre":"Mujer"}}
function importar(){const u=SpreadsheetApp.getUi(),im=sh_("Importar");
 if(!im||im.getLastRow()<2)return u.alert("Primero importe su Excel a una hoja llamada Importar (Archivo → Importar → Insertar hojas nuevas, y renómbrela Importar). Fila 1 = encabezados.");
 let mun=MUN_();if(!mun){const m=u.prompt("Municipio de esta lista (escríbalo igual que en las claves)");if(m.getSelectedButton()!=u.Button.OK)return;mun=m.getResponseText().trim();if(!mun)return}
 Object.keys(COLS).forEach(n=>{if(!sh_(n))SpreadsheetApp.getActive().insertSheet(n).appendRow(COLS[n])});cab_("Padron");cab_("Apoyos");
 const AL={nombrecompleto:"nombre",fechadenacimiento:"nacimiento",domicilio:"direccion",calle:"direccion",codigopostal:"cp",tel:"telefono",celular:"telefono",email:"correo",correoelectronico:"correo",tipodeapoyo:"tipo",apoyo:"tipo",importe:"monto",fechadeentrega:"fecha"};
 const v=im.getDataRange().getValues(),h=v[0].map(x=>AL[norm_(x)]||norm_(x)),col={};IMP_.forEach(k=>col[k]=h.indexOf(k));
 if(col.nombre<0)return u.alert("Falta la columna nombre en la fila 1 de Importar.");
 let rc=h.indexOf("resultado");if(rc<0){rc=h.length;im.getRange(1,rc+1).setValue("resultado")}
 const L=LockService.getScriptLock();L.waitLock(30000);
 try{const pd=sh_("Padron"),ap=sh_("Apoyos"),ya=new Set(pd.getLastRow()>1?pd.getRange(2,1,pd.getLastRow()-1,1).getValues().map(x=>String(x[0])):[]);
  const prev=new Set(ap.getLastRow()>1?ap.getRange(2,2,ap.getLastRow()-1,7).getValues().map(a=>a[0]+"|"+String(a[2]).toLowerCase()+"|"+fec_(a[6])):[]);
  const nP=[],nA=[],res=[],t0=Date.now(),ts=new Date();let hechas=0,i=1;
  for(;i<v.length;i++){const r=v[i],g=k=>col[k]>=0?String(r[col[k]]??"").trim():"";
   if(String(r[rc]??"")!==""){res.push([r[rc]]);continue}
   if(Date.now()-t0>240000)break; /* margen antes del límite de tiempo de Google; se sigue en la siguiente corrida */
   const nom=g("nombre"),curp=g("curp").toUpperCase().replace(/\s/g,"");
   if(!nom){res.push(["Sin nombre: no se importó"]);continue}
   if(curp&&!CURP.test(curp)){res.push(["CURP no válido: corríjalo o bórrelo y vuelva a correr"]);continue}
   let nac=fec_(col.nacimiento>=0?r[col.nacimiento]:""),sx=g("sexo");
   if(/^h/i.test(sx))sx="Hombre";else if(/^m/i.test(sx))sx="Mujer";else sx="";
   if(curp){const d=deCurp_(curp);if(!nacOk_(nac))nac=nacOk_(d.nac)?d.nac:"";if(!sx)sx=d.sexo}else if(!nacOk_(nac))nac="";
   const clave=curp||"SC-"+Utilities.getUuid().slice(0,8).toUpperCase();let nota=[];
   if(!ya.has(clave)){ya.add(clave);nP.push([clave,curp||null,curp?"":clave,nom,mun,g("localidad"),g("telefono"),g("direccion"),"","",g("grupos"),ts,curp?"Completo":"Incompleto",nac,sx,g("colonia"),g("cp"),g("correo")]);nota.push(curp?"Persona nueva":"Persona nueva sin CURP ("+clave+")")}
   else nota.push("Ya estaba en el padrón");
   const pr=g("programa");
   if(pr){const fe=fec_(col.fecha>=0?r[col.fecha]:""),k=clave+"|"+pr.toLowerCase()+"|"+fe,dup=prev.has(k);prev.add(k); /* histórico: repetido = mismo programa y misma fecha (los programas periódicos tienen varias entregas al año) */
    nA.push(["H-"+Utilities.getUuid().slice(0,8),clave,mun,pr,g("eje"),g("area"),g("monto"),fe,"","","","","Histórico fila "+(i+1),dup?"Duplicado probable: mismo programa y año":"","",g("tipo"),g("canal")]);
    nota.push(dup?"apoyo repetido (Revisar)":"apoyo agregado")}
   res.push([nota.join("; ")]);hechas++}
  if(nP.length)pd.getRange(pd.getLastRow()+1,1,nP.length,nP[0].length).setValues(nP);
  if(nA.length)ap.getRange(ap.getLastRow()+1,1,nA.length,nA[0].length).setValues(nA);
  if(res.length)im.getRange(2,rc+1,res.length,1).setValues(res);
  u.alert("Filas procesadas: "+hechas+". Personas nuevas: "+nP.length+". Apoyos: "+nA.length+"."+(i<v.length?"\n\nFaltan filas: vuelva a correr Importar histórico para seguir.":"\n\nTerminado. Revise la columna resultado."))}
 finally{L.releaseLock()}}

/* Una hoja por ayuntamiento: se instala una vez en cada copia de la plantilla. Si detecta que es una copia nueva,
   crea claves y carpeta de fotos propias, para que nada se comparta con la plantilla ni con otros ayuntamientos. */
const MUN_=()=>P_().getProperty("MUN")||"";
function instalar(){const u=SpreadsheetApp.getUi(),id=SpreadsheetApp.getActive().getId(),h=P_().getProperty("HOJA"),copia=!!h&&h!==id;
 if(copia||!MUN_()){const r=u.prompt("Nombre del ayuntamiento","Así lo verán sus capturistas. Ej.: Ayuntamiento de San Andrés Cholula",u.ButtonSet.OK_CANCEL);
  if(r.getSelectedButton()!=u.Button.OK||!r.getResponseText().trim())return;P_().setProperty("MUN",r.getResponseText().trim())}
 if(copia||!P_().getProperty("SAL"))P_().setProperty("SAL",Utilities.getUuid());
 if(copia||!P_().getProperty("CARPETA"))P_().setProperty("CARPETA",DriveApp.createFolder("Padrón fotos · "+MUN_()+" (privada)").getId());
 P_().setProperty("HOJA",id);
 /* Avance se recalcula solo cada madrugada. */
 ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==="avance").forEach(t=>ScriptApp.deleteTrigger(t));
 ScriptApp.newTrigger("avance").timeBased().everyDays(1).atHour(5).create();
 Object.keys(COLS).forEach(n=>{let s=sh_(n)||SpreadsheetApp.getActive().insertSheet(n);
  if(s.getLastRow()==0){s.appendRow(COLS[n]);s.setFrozenRows(1)}});
 const c=sh_("Catalogos");if(c.getLastRow()==1)c.getRange(2,1,2,3).setValues([["*","grupo","Adulto mayor"],["*","grupo","Persona con discapacidad"]]);
 /* Aviso al editar a mano el historial y las claves (no bloquea, solo advierte). */
 ["Capturas","Claves"].forEach(n=>{const s=sh_(n);if(!s.getProtections(SpreadsheetApp.ProtectionType.SHEET).length)s.protect().setDescription("Historial: no editar").setWarningOnly(true)});
 u.alert("Listo para "+MUN_()+". En Catalogos escriba localidades, grupos y el aviso de privacidad (tipo aviso). Los apoyos se dan de alta desde la app o en Eventos. Siga con Implementar → Nueva implementación.")}

/* Completa encabezados de columnas nuevas en hojas creadas con versiones anteriores. */
function cab_(n){const s=sh_(n),c=COLS[n],h=s.getRange(1,1,1,c.length).getValues()[0];
 c.forEach((x,i)=>{if(h[i]===""||h[i]===undefined)s.getRange(1,i+1).setValue(x)})}

function hash_(c){return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,P_().getProperty("SAL")+String(c).trim().toUpperCase()))}
function quien_(c){if(!c)return null;const h=hash_(c),v=sh_("Claves").getDataRange().getValues();
 for(let i=1;i<v.length;i++)if(v[i][3]===h&&String(v[i][4]).toUpperCase()==="SI")return{id:v[i][0],nombre:v[i][1],mun:v[i][2]};return null}

function nuevaClave(){const u=SpreadsheetApp.getUi();
 const a=u.prompt("Nombre del capturista");if(a.getSelectedButton()!=u.Button.OK)return;
  if(!MUN_())return u.alert("Primero corra 1. Instalar.");
 const k=clave_(a.getResponseText().trim(),MUN_());
 u.alert("Clave de "+a.getResponseText()+": "+k+"\n\nEntréguela en persona. No se vuelve a mostrar. Para darla de baja, escriba NO en la columna activa de la hoja Claves.")}

function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
function doGet(){return json_({ok:true,servicio:"padron-captura",mun:MUN_()})}

function doPost(e){
 try{const h=P_().getProperty("HOJA");if(h&&h!==SpreadsheetApp.getActive().getId())return json_({ok:false,error:"instalar"}); /* copia sin instalar */
  const d=JSON.parse(e.postData.contents),q=quien_(d.clave);
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

function catalogo_(mun){const o={localidad:[],grupo:[],evento:[],aviso:[]},v=sh_("Catalogos").getDataRange().getValues();
 for(let i=1;i<v.length;i++)if((v[i][0]==="*"||v[i][0]===mun)&&o[v[i][1]])o[v[i][1]].push(v[i][2]);
 eventos_(mun).filter(e=>String(e[10]).toUpperCase()!=="NO").forEach(e=>o.evento.push({id:String(e[0]),n:String(e[2]),programa:String(e[3]),tipo:String(e[4]),
  eje:String(e[5]),area:String(e[6]),canal:String(e[7]),monto:e[8]===""?"":Number(e[8]),fecha:e[9] instanceof Date?Utilities.formatDate(e[9],"America/Mexico_City","yyyy-MM-dd"):String(e[9]),base:String(e[13]||""),periodo:String(e[14]||"")}));return o}

/* Alta de un apoyo desde la app. Si ya existe ese id no hace nada (reenvíos). */
function crearEv_(q,v){v=v||{};const t=x=>String(x==null?"":x).trim().slice(0,200),id=t(v.id),n=t(v.n),mo=v.monto===""||v.monto==null?"":Number(v.monto),fe=t(v.fecha);
 if(!/^EV-[A-Z0-9]{4,20}$/.test(id)||!n||(mo!==""&&!(mo>=0))||(fe&&!/^\d{4}-\d{2}-\d{2}$/.test(fe)))return false;
 const L=LockService.getScriptLock();L.waitLock(25000);
 try{let s=sh_("Eventos");if(!s){s=SpreadsheetApp.getActive().insertSheet("Eventos");s.appendRow(COLS.Eventos);s.setFrozenRows(1)}cab_("Eventos");
  if(!eventos_(q.mun).some(e=>String(e[0])===id))s.appendRow([id,q.mun,n,t(v.programa),t(v.tipo),t(v.eje),t(v.area),t(v.canal),mo,fe,"SI",q.id,new Date(),t(v.base),t(v.periodo)]);return true}
 finally{L.releaseLock()}}
const eventos_=mun=>{const s=sh_("Eventos");return s&&s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,15).getValues().filter(e=>e[0]!==""&&(e[1]==="*"||e[1]===mun)):[]};

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
 if(r.programa){const ap=sh_("Apoyos"),av=ap.getLastRow()>1?ap.getRange(2,2,ap.getLastRow()-1,14).getValues():[];
  /* Repetido = misma persona, mismo programa y año. NO cuenta como repetido otra entrega o periodo del mismo apoyo
     periódico (eventos de la misma familia: base). Sí cuenta recibir dos veces la misma entrega. */
  const fam={};eventos_(q.mun).forEach(e=>fam[String(e[0])]=String(e[13]||"")||String(e[0]));const F=x=>x?fam[x]||x:"";
  const k=clave+"|"+String(r.programa).toLowerCase()+"|"+yr_(r.fecha),ide=String(r.evento||"");let aviso="";
  if(av.some(a=>a[0]+"|"+String(a[2]).toLowerCase()+"|"+yr_(a[6])===k&&(!ide||String(a[13])===ide||F(String(a[13]))!==F(ide)))){aviso="Duplicado probable: mismo programa y año";estado="Revisar"}
  ap.appendRow([r.id,clave,mun,r.programa,r.eje||"",r.area||"",r.monto||"",r.fecha||"",lat,lng,ben,apo,r.id,aviso,r.evento||"",r.tipo||"",r.canal||""])
 }
 sc.appendRow([r.id,ts,q.id,mun,estado,curp,folio,nombre,r.localidad||"",r.tel||"",r.direccion||"",lat,lng,grupos,
  r.programa||"",r.eje||"",r.area||"",r.monto||"",r.fecha||"",ben,apo,ine,r.notas||"",motivo,nac,sexo,r.evento||"",r.tipo||"",r.canal||"",...ext,iner]);
 return{ok:true}}
 finally{L.releaseLock()}}
