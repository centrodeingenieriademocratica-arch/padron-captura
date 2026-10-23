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
   v11 (NO PROBADO): Excel histórico tal como venga (reconoce encabezados distintos, une apellidos, conserva todas las columnas);
   ubicar direcciones en el mapa (geocodificar, gratis, diario); ubicación escrita a mano o por dirección si se captura fuera del domicilio.
   v13 (NO PROBADO): al crear un apoyo se pregunta si es periódico (columna periodicidad); en nuevas entregas lo fundamental queda fijo.
   v12 (NO PROBADO): modo evento: el evento guarda lugar, ubicación y localidad una vez; Apoyos se ubica en el lugar de entrega.
   v15 (NO PROBADO): un solo servidor para todos los ayuntamientos (código m en el enlace); "Nuevo ayuntamiento" crea su hoja,
   carpeta, enlace y clave de administrador; el administrador da claves e importa Excel desde la app.
   v14 (NO PROBADO): importar Excel desde la app (acción importar): se guarda tal cual en una hoja Importar y pasa al padrón.
   v7 (NO PROBADO): los apoyos también se dan de alta desde la app (funciona sin señal); llegan a Eventos. */
const COLS={
 Claves:["id","nombre","municipio","hash","activa","rol"],
 Catalogos:["municipio","tipo","valor"],
 Capturas:["id","ts","capturista","municipio","estado","curp","folio","nombre","localidad","tel","direccion","lat","lng","grupos","programa","eje","area","monto","fecha","fotoBen","fotoApoyo","fotoIne","notas","motivoSinGps","nacimiento","sexo","evento","tipo","canal","colonia","cp","correo","fotoIneReverso","origen_ubicacion"],
 Padron:["clave","curp","folio","nombre","municipio","localidad","tel","direccion","lat","lng","grupos","primera_captura","estado","nacimiento","sexo","colonia","cp","correo","origen_ubicacion","precision"],
 Apoyos:["id","clave","municipio","programa","eje","area","monto","fecha","lat","lng","fotoBen","fotoApoyo","captura","aviso","evento","tipo","canal"],
 /* Cada área da de alta aquí sus apoyos; el capturista solo elige el nombre. Monto vacío = lo escribe el capturista. Fecha vacía = día de la captura. */
 Eventos:["id","municipio","nombre","programa","tipo","eje","area","canal","monto","fecha","activo","creado_por","creado","base","periodo","lugar","lugar_direccion","lugar_lat","lugar_lng","localidad","periodicidad"]
};
/* Deben ser idénticas a las listas de la app. */
const MOTIVOS=["Captura fuera del domicilio (oficina, evento)","GPS sin señal o no funciona","La persona no permitió tomar la ubicación","Domicilio de difícil acceso","Otro (explicar en Notas)"];
const SEXOS=["Mujer","Hombre"];
const CURP=/^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;
const yr_=x=>x instanceof Date?String(x.getFullYear()):String(x).slice(0,4);
/* Un solo servidor para todos los ayuntamientos. Cada uno tiene su propia hoja en Drive (SS), elegida por el código m
   del enlace de la app; sus propiedades (SAL, CARPETA, MUN…) llevan el id de su hoja como prefijo. Sin SS = la hoja central. */
let SS=null;
const AC_=()=>SS||SpreadsheetApp.getActive();
const sh_=n=>AC_().getSheetByName(n);
const SP_=()=>PropertiesService.getScriptProperties();
const P_=()=>{const x=SS?SS.getId()+":":"",p=SP_();return{getProperty:k=>p.getProperty(x+k),setProperty:(k,v)=>p.setProperty(x+k,v)}};
const PAGINA="https://centrodeingenieriademocratica-arch.github.io/padron-captura/";

function onOpen(){SpreadsheetApp.getUi().createMenu("Padrón")
 .addItem("1. Instalar (una sola vez)","instalar").addItem("2. Nuevo ayuntamiento","nuevoAyto")
 .addItem("3. Nueva clave de administrador (fila elegida en Ayuntamientos)","claveAdmin")
 .addItem("4. Actualizar Avance de todos","avanceTodos").addItem("5. Ubicar direcciones en el mapa (todos)","ubicarTodos").addToUi()}

/* Clave de 10 caracteres; en la hoja solo queda su huella (hash). rol: admin (da claves e importa Excel) o capturista. */
function clave_(nom,mun,rol){const al="ABCDEFGHJKMNPQRSTUVWXYZ23456789";let k="";for(let i=0;i<10;i++)k+=al[Math.floor(Math.random()*al.length)];
 sh_("Claves").appendRow([Utilities.getUuid().slice(0,8),nom,mun,hash_(k),"SI",rol==="admin"?"admin":"capturista"]);return k}

/* ---- Avance: resumen para el informe (por municipio, por capturista y por día). Se recalcula cada vez que se corre. ---- */
function avance(){const A=AC_(),rows=n=>{const s=sh_(n);return s&&s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,s.getLastColumn()).getValues():[]};
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

/* ---- Importar beneficiarios históricos desde Excel, TAL COMO VENGAN ----
   El administrador importa cada Excel a una hoja cuyo nombre empiece con "Importar" (ej. "Importar DIF 2024").
   No se cambia ni se borra nada de esa hoja: todas sus columnas se conservan. Solo se agregan al final
   "clave_padron" (la persona en Padron) y "resultado". Las columnas se reconocen por su encabezado aunque cada área
   los llame distinto (ver CAMPOS_). Lo que no se reconoce se queda en esa hoja como dato original.
   Se une solo por CURP; sin CURP, cada fila es una persona nueva con folio SC-. Se puede correr varias veces. */
const norm_=x=>String(x).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
const fec_=x=>x instanceof Date?Utilities.formatDate(x,"America/Mexico_City","yyyy-MM-dd"):String(x||"").trim();
/* Fecha y sexo desde el CURP: posiciones 5-10 (AAMMDD) y 11 (H/M). El dígito 17 distingue siglo: número = 1900, letra = 2000. */
function deCurp_(c){const a=+c.slice(4,6),s=/\d/.test(c[16])?1900:2000;return{nac:(s+a)+"-"+c.slice(6,8)+"-"+c.slice(8,10),sexo:c[10]==="H"?"Hombre":"Mujer"}}
/* Campo → prueba sobre el encabezado normalizado (sin acentos, espacios ni signos). El orden importa. */
const CAMPOS_=[
 ["curp",h=>h.includes("curp")],
 ["paterno",h=>h.includes("paterno")||h.includes("primerapellido")],
 ["materno",h=>h.includes("materno")||h.includes("segundoapellido")],
 ["apellidos",h=>h==="apellidos"||h==="apellido"],
 ["nacimiento",h=>h.includes("nacimiento")||h.startsWith("fechanac")||h==="fnac"],
 ["nombre",h=>/^(nombre|nombres|nombrecompleto|nombredelbeneficiario|nombrebeneficiario|beneficiario|beneficiaria|nombredelapersona|solicitante)$/.test(h)],
 ["sexo",h=>h==="sexo"||h==="genero"||h==="hm"],
 ["lat",h=>h==="lat"||h.startsWith("latitud")],
 ["lng",h=>h==="lng"||h==="lon"||h==="long"||h.startsWith("longitud")],
 ["cp",h=>h==="cp"||h.includes("codigopostal")||h==="postal"],
 ["colonia",h=>h.includes("colonia")||h.includes("barrio")||h.includes("fraccionamiento")||h.includes("unidadhabitacional")],
 ["localidad",h=>h.includes("localidad")||h.includes("comunidad")||h.includes("juntaauxiliar")||h.includes("inspectoria")||h.includes("ranchería")||h.includes("rancheria")],
 ["numero",h=>/^(numero|num|noext|numext|numeroexterior|exterior|nointerior|numint|numerointerior|interior)$/.test(h)],
 ["direccion",h=>h.includes("domicilio")||h.includes("direccion")||h==="calle"||h.includes("calleynumero")],
 ["telefono",h=>h.includes("tel")||h.includes("celular")||h.includes("movil")],
 ["correo",h=>h.includes("correo")||h.includes("email")||h==="mail"],
 ["grupos",h=>h.includes("grupo")||h.includes("vulnerab")||h.includes("condicion")],
 ["programa",h=>h.includes("programa")],
 ["tipo",h=>h.includes("tipodeapoyo")||h==="apoyo"||h.includes("beneficio")||h==="concepto"||h.includes("tipoapoyo")],
 ["eje",h=>h==="eje"||h.startsWith("eje")],
 ["area",h=>h==="area"||h.includes("dependencia")||h.includes("unidadresponsable")||h.includes("departamento")||h.includes("areaquelootorga")],
 ["canal",h=>h.includes("canal")],
 ["monto",h=>h.includes("monto")||h.includes("importe")||h==="valor"||h.includes("cantidadentregada")],
 ["fecha",h=>h==="fecha"||h.includes("fechadeentrega")||h.includes("fechaentrega")||h.includes("fechadeapoyo")]];
/* Qué columna del Excel corresponde a cada campo. */
function mapa_(hd){const h=hd.map(norm_),col={},usada={},rc=h.indexOf("resultado"),kc=h.indexOf("clavepadron");
 CAMPOS_.forEach(([c,f])=>{col[c]=[];h.forEach((x,i)=>{if(x&&!usada[i]&&i!==rc&&i!==kc&&f(x)){col[c].push(i);usada[i]=1}})});
 return{col,usada,rc,kc,nombre:!!(col.nombre.length||col.paterno.length||col.apellidos.length),programa:!!(col.programa.length||col.tipo.length),area:!!col.area.length}}
/* Pasa al padrón las filas de la hoja im que aún no tienen resultado. prL/arL: programa y área de toda la lista si no vienen en columnas. */
function imp_(im,mun,prL,arL){const A=AC_();
 Object.keys(COLS).forEach(n=>{if(!sh_(n))A.insertSheet(n).appendRow(COLS[n])});cab_("Padron");cab_("Apoyos");
 const v=im.getDataRange().getValues(),hd=v[0].map(String),m=mapa_(hd),col=m.col,usada=m.usada;let rc=m.rc,kc=m.kc;
 if(kc<0){kc=hd.length;im.getRange(1,kc+1).setValue("clave_padron")}
 if(rc<0){rc=Math.max(hd.length,kc+1);im.getRange(1,rc+1).setValue("resultado")}
 const L=LockService.getScriptLock();L.waitLock(30000);
 try{const pd=sh_("Padron"),ap=sh_("Apoyos"),ya=new Set(pd.getLastRow()>1?pd.getRange(2,1,pd.getLastRow()-1,1).getValues().map(x=>String(x[0])):[]);
  const prev=new Set(ap.getLastRow()>1?ap.getRange(2,2,ap.getLastRow()-1,7).getValues().map(a=>a[0]+"|"+String(a[2]).toLowerCase()+"|"+fec_(a[6])):[]);
  const nP=[],nA=[],res=[],t0=Date.now(),ts=new Date(),hoja=im.getName();let hechas=0,i=1;
  for(;i<v.length;i++){const r=v[i],g=k=>col[k].map(j=>String(r[j]??"").trim()).filter(Boolean).join(" "),gr=k=>col[k].length?r[col[k][0]]:"";
   if(String(r[rc]??"")!==""){res.push([r[kc]??"",r[rc]]);continue}
   if(Date.now()-t0>240000)break; /* margen antes del límite de tiempo de Google; se sigue en la siguiente corrida */
   if(r.every(x=>String(x).trim()==="")){res.push(["","Fila vacía"]);continue}
   const ap_=[g("paterno"),g("materno")].filter(Boolean).join(" ")||g("apellidos"),nom=[g("nombre"),ap_].filter(Boolean).join(" ").replace(/\s+/g," ").toUpperCase();
   const curp=g("curp").toUpperCase().replace(/[^A-Z0-9]/g,"");
   if(!nom){res.push(["","Sin nombre: no se importó"]);continue}
   const cv=CURP.test(curp)?curp:"";let nota=[];if(curp&&!cv)nota.push("CURP no válido ("+curp+"): se importó sin CURP");
   let nac=fec_(gr("nacimiento")),sx=g("sexo");
   sx=/^(h|masc)/i.test(sx)?"Hombre":/^(m|f)/i.test(sx)?"Mujer":""; /* H/M como en la INE; también Hombre, Masculino, Mujer, Femenino */
   if(cv){const d=deCurp_(cv);if(!nacOk_(nac))nac=nacOk_(d.nac)?d.nac:"";if(!sx)sx=d.sexo}else if(!nacOk_(nac))nac="";
   const la=Number(gr("lat")),lo=Number(gr("lng")),geo=enMx_(la,lo);
   const dir=[g("direccion"),g("numero")].filter(Boolean).join(" ");
   const clave=cv||"SC-"+Utilities.getUuid().slice(0,8).toUpperCase();
   if(!ya.has(clave)){ya.add(clave);nP.push([clave,cv||null,cv?"":clave,nom,mun,g("localidad"),g("telefono"),dir,geo?la:"",geo?lo:"",g("grupos"),ts,cv?"Completo":"Incompleto",nac,sx,g("colonia"),g("cp"),g("correo"),geo?"Del Excel":(dir||g("colonia")?"Pendiente":""),""]);nota.push(cv?"Persona nueva":"Persona nueva sin CURP")}
   else nota.push("Ya estaba en el padrón");
   const pr=g("programa")||prL||g("tipo");
   if(pr){const fe=fec_(gr("fecha")),k=clave+"|"+pr.toLowerCase()+"|"+fe,dup=prev.has(k);prev.add(k);
    nA.push(["H-"+Utilities.getUuid().slice(0,8),clave,mun,pr,g("eje"),g("area")||arL,gr("monto"),fe,geo?la:"",geo?lo:"","","",hoja+" fila "+(i+1),dup?"Duplicado probable: mismo programa y fecha":"","",g("tipo"),g("canal")]);
    nota.push(dup?"apoyo repetido (Revisar)":"apoyo agregado")}
   res.push([clave,nota.join("; ")]);hechas++}
  if(nP.length)pd.getRange(pd.getLastRow()+1,1,nP.length,nP[0].length).setValues(nP);
  if(nA.length)ap.getRange(ap.getLastRow()+1,1,nA.length,nA[0].length).setValues(nA);
  if(res.length){im.getRange(2,kc+1,res.length,1).setValues(res.map(x=>[x[0]]));im.getRange(2,rc+1,res.length,1).setValues(res.map(x=>[x[1]]))}
  return{hechas,nuevas:nP.length,apoyos:nA.length,falta:i<v.length,hoja,
   usadas:CAMPOS_.filter(([c])=>col[c].length).map(([c])=>col[c].map(j=>hd[j]).join("+")+" → "+c),
   sinUsar:hd.filter((x,j)=>x&&!usada[j]&&j!==rc&&j!==kc)}}
 finally{L.releaseLock()}}

/* Importar desde la app: el Excel llega en partes (fila 0 = encabezados en la primera parte). Se guarda tal cual en una hoja
   "Importar <archivo>" (dato original, todas las columnas) y se pasa al padrón. Sin filas = solo seguir procesando. */
function impWeb_(q,d){const lote=String(d.lote||"").replace(/[^A-Z0-9]/gi,"").slice(0,8),nom=String(d.nombre||"Excel").replace(/[\[\]*?:\/\\']/g," ").trim().slice(0,60);
 if(!lote)return{ok:false,error:"datos"};
 const A=AC_(),nh="Importar "+nom+" · "+lote,f=Array.isArray(d.filas)?d.filas.slice(0,1000):[];
 let im=A.getSheetByName(nh);
 if(!im){if(!f.length)return{ok:false,error:"datos"};
  const m=mapa_(f[0].map(x=>String(x??"")));if(!m.nombre)return{ok:false,error:"sinnombre",encabezados:f[0].map(String)};
  im=A.insertSheet(nh);im.getRange(1,1,1,f[0].length).setNumberFormat("@")}
 /* desde = filas que ya debería tener la hoja; si ya las tiene, esta parte llegó antes (reintento) y no se repite. */
 if(f.length&&!(Number(d.desde)>=0&&im.getLastRow()>Number(d.desde))){const w=Math.max(...f.map(r=>Array.isArray(r)?r.length:0)),c=x=>x==null?"":typeof x==="number"?x:String(x).slice(0,500);
  const rows=f.map(r=>{r=Array.isArray(r)?r.map(c):[];while(r.length<w)r.push("");return r});
  const ini=im.getLastRow()+1;im.getRange(ini,1,rows.length,w).setNumberFormat("@").setValues(rows.map(r=>r.map(String)))}
 const m=mapa_(im.getRange(1,1,1,im.getLastColumn()).getValues()[0].map(String));
 const r=imp_(im,MUN_()||q.mun,m.programa?"":String(d.programa||"").trim().slice(0,120),m.area?"":String(d.area||"").trim().slice(0,120));
 return{ok:true,hechas:r.hechas,nuevas:r.nuevas,apoyos:r.apoyos,falta:r.falta,usadas:r.usadas,sinUsar:r.sinUsar,programa:m.programa,area:m.area}}

/* ---- Ubicar en el mapa (geocodificar) las personas sin coordenadas, a partir de su dirección. Gratis, con el servicio
   Maps de Apps Script (tiene límite diario; lo que falte se sigue al día siguiente: corre solo cada madrugada). ---- */
const enMx_=(a,o)=>isFinite(a)&&isFinite(o)&&a>=14&&a<=33&&o>=-118.5&&o<=-86;
function geocodificar(lim){lim=lim||Date.now()+270000;const pd=sh_("Padron");if(!pd||pd.getLastRow()<2)return{ok:0,no:0,falta:0};cab_("Padron");
 const n=pd.getLastRow()-1,v=pd.getRange(2,1,n,20).getValues(),G=Maps.newGeocoder().setRegion("mx").setLanguage("es");
 const est=P_().getProperty("ESTADO")||"Puebla";let ok=0,no=0,falta=0,alto=false;
 for(let i=0;i<n;i++){const r=v[i];if(r[8]!==""&&r[9]!=="")continue;const o=String(r[18]);if(o==="No encontrada")continue;
  if(!String(r[7]).trim()&&!String(r[15]).trim()&&!String(r[5]).trim())continue;
  if(alto||Date.now()>lim){falta++;continue}
  const m=String(r[4]).replace(/^(h\.?\s*)?ayuntamiento\s+(municipal\s+)?(constitucional\s+)?de\s+/i,"");
  const q=[r[7],r[15],r[16]?"C.P. "+r[16]:"",r[5],m,est,"México"].map(x=>String(x).trim()).filter(Boolean).join(", ");
  let x;try{x=G.geocode(q)}catch(e){alto=true;falta++;continue}
  if(x.status==="OK"&&x.results&&x.results.length){const p=x.results[0].geometry;
   if(enMx_(p.location.lat,p.location.lng)){pd.getRange(i+2,9,1,2).setValues([[p.location.lat,p.location.lng]]);
    pd.getRange(i+2,19,1,2).setValues([["Geocodificada",p.location_type==="ROOFTOP"?"Exacta":p.location_type==="RANGE_INTERPOLATED"?"Calle":"Aproximada (colonia o localidad)"]]);ok++;continue}}
  if(x.status==="ZERO_RESULTS"||x.status==="OK"){pd.getRange(i+2,19).setValue("No encontrada");no++}else{alto=true;falta++}
  Utilities.sleep(150)}
 return{ok,no,falta}}
/* ---- Ayuntamientos ----
   Hoja central (esta): Instalar una vez y publicar como aplicación web. Después, "Nuevo ayuntamiento" crea solo su hoja
   en la misma carpeta de Drive, su carpeta privada de fotos, su primera clave (administrador) y su enlace de la app.
   Cada ayuntamiento ve solo su nombre y sus datos; el administrador de cada uno da las claves a sus capturistas desde la app. */
const MUN_=()=>P_().getProperty("MUN")||"";
// Carpeta donde está la hoja central; si no se puede leer, la raíz de Drive.
function carpetaHoja_(){try{var it=DriveApp.getFileById(SpreadsheetApp.getActive().getId()).getParents();if(it.hasNext())return it.next()}catch(e){}return DriveApp.getRootFolder()}
const AYTOS=["municipio","hoja","enlace de la app","codigo","creado"];
function aytos_(){const A=SpreadsheetApp.getActive();let s=A.getSheetByName("Ayuntamientos");if(!s){s=A.insertSheet("Ayuntamientos");s.appendRow(AYTOS);s.setFrozenRows(1)}return s}
/* Llama f con SS = la hoja de cada ayuntamiento registrado. */
function cadaAyto_(f){const v=aytos_().getDataRange().getValues();for(let i=1;i<v.length;i++){const id=SP_().getProperty("T:"+v[i][3]);if(!id)continue;
 try{SS=SpreadsheetApp.openById(id);f(v[i][0])}catch(e){console.log("Ayuntamiento "+v[i][0]+": "+e)}finally{SS=null}}}

function instalar(){const u=SpreadsheetApp.getUi();aytos_();
 /* Cada madrugada: Avance y ubicar direcciones de todos los ayuntamientos. */
 ScriptApp.getProjectTriggers().filter(t=>["avance","geocodificar","avanceTodos","geocodificarTodos"].indexOf(t.getHandlerFunction())>=0).forEach(t=>ScriptApp.deleteTrigger(t));
 ScriptApp.newTrigger("avanceTodos").timeBased().everyDays(1).atHour(5).create();
 ScriptApp.newTrigger("geocodificarTodos").timeBased().everyDays(1).atHour(3).create();
 u.alert("Instalado. Falta un solo paso, una sola vez: en Extensiones → Apps Script, Implementar → Nueva implementación → Aplicación web, con Ejecutar como: Yo y Quién tiene acceso: Cualquier persona. Después use Padrón → 2. Nuevo ayuntamiento para cada ayuntamiento.")}

/* URL pública del servidor (la de la implementación, termina en /exec). Se pide una vez: ScriptApp.getService().getUrl()
   puede devolver la de prueba, que solo sirve a quien edita el código. */
function urlServ_(u){let url=SP_().getProperty("URL");const ok=x=>/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(x||"");
 if(ok(url))return url;
 const r=u.prompt("Dirección del servidor","Pegue la URL de la aplicación web: en Apps Script, Implementar → Gestionar implementaciones → copie la URL que termina en /exec. Se pide una sola vez.",u.ButtonSet.OK_CANCEL);
 url=r.getSelectedButton()==u.Button.OK?r.getResponseText().trim():"";
 if(!ok(url)){u.alert("Esa no es una URL de aplicación web de Apps Script (debe empezar con https://script.google.com/macros/s/ y terminar en /exec).");return null}
 SP_().setProperty("URL",url);return url}
function nuevoAyto(){const u=SpreadsheetApp.getUi(),url=urlServ_(u);if(!url)return;
 const r=u.prompt("Nuevo ayuntamiento","Nombre como lo verán sus capturistas. Ej.: Ayuntamiento de San Andrés Cholula",u.ButtonSet.OK_CANCEL);
 if(r.getSelectedButton()!=u.Button.OK||!r.getResponseText().trim())return;
 const mun=r.getResponseText().trim().slice(0,100),ya=aytos_().getDataRange().getValues().slice(1).some(x=>norm_(x[0])===norm_(mun));
 if(ya&&u.alert("Ya existe "+mun+". ¿Crear otro?",u.ButtonSet.YES_NO)!=u.Button.YES)return;
 const k=altaAyto_(mun,url);
 u.alert("Listo: "+mun+"\n\nEnlace de la app (para todos sus capturistas):\n"+k.enlace+"\n\nClave del administrador del ayuntamiento: "+k.clave+"\n\nEntréguela en persona; no se vuelve a mostrar. Con ella, en la app, da las claves a sus capturistas e importa sus listas de Excel. El enlace queda en la hoja Ayuntamientos.")}
/* Crea la hoja del ayuntamiento y la deja lista. Devuelve el enlace de la app y la clave de su administrador. */
function altaAyto_(mun,url){const tok=Utilities.getUuid().replace(/-/g,"").slice(0,12).toUpperCase(),dir=carpetaHoja_();
 const nueva=SpreadsheetApp.create("Padrón de beneficiarios · "+mun.replace(/^(h\.?\s*)?ayuntamiento\s+(municipal\s+)?(constitucional\s+)?de\s+/i,""));
 try{DriveApp.getFileById(nueva.getId()).moveTo(dir)}catch(e){}
 SS=nueva;
 try{P_().setProperty("MUN",mun);P_().setProperty("SAL",Utilities.getUuid());
  P_().setProperty("CARPETA",dir.createFolder("Padrón fotos · "+mun+" (privada)").getId());
  const def=nueva.getSheets()[0];
  Object.keys(COLS).forEach(n=>{const s=nueva.insertSheet(n);s.appendRow(COLS[n]);s.setFrozenRows(1)});
  try{nueva.deleteSheet(def)}catch(e){}
  sh_("Catalogos").getRange(2,1,2,3).setValues([["*","grupo","Adulto mayor"],["*","grupo","Persona con discapacidad"]]);
  /* Aviso al editar a mano el historial y las claves (no bloquea, solo advierte). */
  ["Capturas","Claves"].forEach(n=>sh_(n).protect().setDescription("Historial: no editar").setWarningOnly(true));
  const clave=clave_("Administrador",mun,"admin"),enlace=PAGINA+"?srv="+encodeURIComponent(url)+"&m="+tok;
  SP_().setProperty("T:"+tok,nueva.getId());
  SS=null;aytos_().appendRow([mun,nueva.getUrl(),enlace,tok,new Date()]);
  return{clave,enlace}}
 finally{SS=null}}
/* Clave nueva de administrador para el ayuntamiento de la fila elegida en la hoja Ayuntamientos (si se perdió la anterior). */
function claveAdmin(){const u=SpreadsheetApp.getUi(),s=SpreadsheetApp.getActiveSheet();
 if(s.getName()!=="Ayuntamientos"||s.getActiveCell().getRow()<2)return u.alert("Abra la hoja Ayuntamientos, haga clic en la fila del ayuntamiento y vuelva a este menú.");
 const f=s.getRange(s.getActiveCell().getRow(),1,1,4).getValues()[0],id=SP_().getProperty("T:"+f[3]);if(!id)return u.alert("Esa fila no es un ayuntamiento registrado.");
 SS=SpreadsheetApp.openById(id);let k;try{k=clave_("Administrador",MUN_(),"admin")}finally{SS=null}
 u.alert("Clave nueva de administrador de "+f[0]+": "+k+"\n\nEntréguela en persona; no se vuelve a mostrar.")}
function avanceTodos(){cadaAyto_(()=>avance())}
function geocodificarTodos(){const lim=Date.now()+300000;cadaAyto_(()=>{if(Date.now()<lim)geocodificar(lim)})}
function ubicarTodos(){const t={ok:0,no:0,falta:0},lim=Date.now()+300000;cadaAyto_(()=>{const r=geocodificar(lim);t.ok+=r.ok;t.no+=r.no;t.falta+=r.falta});
 SpreadsheetApp.getUi().alert("Ubicadas: "+t.ok+". No encontradas: "+t.no+" (corrija la dirección en Padron y borre \"No encontrada\" en origen_ubicacion para reintentar). Pendientes: "+t.falta+(t.falta?" (se siguen solas cada madrugada).":"."))}
/* Completa encabezados de columnas nuevas en hojas creadas con versiones anteriores. */
function cab_(n){const s=sh_(n),c=COLS[n],h=s.getRange(1,1,1,c.length).getValues()[0];
 c.forEach((x,i)=>{if(h[i]===""||h[i]===undefined)s.getRange(1,i+1).setValue(x)})}

function hash_(c){return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,P_().getProperty("SAL")+String(c).trim().toUpperCase()))}
function quien_(c){if(!c)return null;const h=hash_(c),v=sh_("Claves").getDataRange().getValues();
 for(let i=1;i<v.length;i++)if(v[i][3]===h&&String(v[i][4]).toUpperCase()==="SI")return{id:v[i][0],nombre:v[i][1],mun:v[i][2],rol:v[i][5]==="admin"?"admin":"capturista"};return null}

function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
/* Elige la hoja del ayuntamiento por el código m del enlace. */
function ayto_(m){const id=/^[A-Z0-9]{12}$/.test(String(m||""))?SP_().getProperty("T:"+m):null;SS=id?SpreadsheetApp.openById(id):null;return!!SS}
function doGet(e){const ok=ayto_(e&&e.parameter&&e.parameter.m);return json_({ok:true,servicio:"padron-captura",mun:ok?MUN_():""})}

function doPost(e){
 try{const d=JSON.parse(e.postData.contents);if(!ayto_(d.m))return json_({ok:false,error:"enlace"});
  const q=quien_(d.clave);
  if(!q)return json_({ok:false,error:"clave"});
  if(d.a==="login")return json_({ok:true,nombre:q.nombre,mun:q.mun,rol:q.rol,cat:catalogo_(q.mun)});
  if(d.a==="buscar")return json_(buscar_(q,d.curp));
  if(d.a==="guardar")return json_(guardar_(q,d.reg||{}));
  if(q.rol!=="admin"&&["importar","clave","claves","baja"].indexOf(d.a)>=0)return json_({ok:false,error:"permiso"});
  if(d.a==="importar")return json_(impWeb_(q,d));
  if(d.a==="clave"){const n=String(d.nombre||"").trim().slice(0,80);if(!n)return json_({ok:false,error:"datos"});return json_({ok:true,clave:clave_(n,MUN_(),d.rol==="admin"?"admin":"capturista")})}
  if(d.a==="claves"){const v=sh_("Claves").getDataRange().getValues().slice(1);return json_({ok:true,claves:v.map(r=>({id:r[0],n:r[1],activa:String(r[4]).toUpperCase()==="SI",rol:r[5]==="admin"?"admin":"capturista"}))})}
  if(d.a==="baja"){if(d.id===q.id)return json_({ok:false,error:"propia"});const s=sh_("Claves"),v=s.getDataRange().getValues();
   for(let i=1;i<v.length;i++)if(v[i][0]===d.id){s.getRange(i+1,5).setValue("NO");return json_({ok:true})}return json_({ok:false,error:"datos"})}
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
  eje:String(e[5]),area:String(e[6]),canal:String(e[7]),monto:e[8]===""?"":Number(e[8]),fecha:e[9] instanceof Date?Utilities.formatDate(e[9],"America/Mexico_City","yyyy-MM-dd"):String(e[9]),base:String(e[13]||""),periodo:String(e[14]||""),lugar:String(e[15]||""),ldir:String(e[16]||""),llat:e[17]===""?"":Number(e[17]),llng:e[18]===""?"":Number(e[18]),loc:String(e[19]||""),per:String(e[20]||"")}));return o}

/* Alta de un apoyo desde la app. Si ya existe ese id no hace nada (reenvíos). */
function crearEv_(q,v){v=v||{};const t=x=>String(x==null?"":x).trim().slice(0,200),id=t(v.id),n=t(v.n),mo=v.monto===""||v.monto==null?"":Number(v.monto),fe=t(v.fecha);
 if(!/^EV-[A-Z0-9]{4,20}$/.test(id)||!n||(mo!==""&&!(mo>=0))||(fe&&!/^\d{4}-\d{2}-\d{2}$/.test(fe)))return false;
 const L=LockService.getScriptLock();L.waitLock(25000);
 try{let s=sh_("Eventos");if(!s){s=AC_().insertSheet("Eventos");s.appendRow(COLS.Eventos);s.setFrozenRows(1)}cab_("Eventos");
  if(!eventos_(q.mun).some(e=>String(e[0])===id)){let la=Number(v.llat),lo=Number(v.llng);
   /* Lugar de entrega sin coordenadas pero con dirección: se ubica una sola vez aquí. */
   if(!enMx_(la,lo)){la="";lo="";if(t(v.ldir))try{const x=Maps.newGeocoder().setRegion("mx").setLanguage("es").geocode([t(v.ldir),t(v.loc),MUN_()||q.mun,P_().getProperty("ESTADO")||"Puebla","México"].filter(String).join(", "));
    if(x.status==="OK"&&x.results.length&&enMx_(x.results[0].geometry.location.lat,x.results[0].geometry.location.lng)){la=x.results[0].geometry.location.lat;lo=x.results[0].geometry.location.lng}}catch(e){}}
   s.appendRow([id,q.mun,n,t(v.programa),t(v.tipo),t(v.eje),t(v.area),t(v.canal),mo,fe,"SI",q.id,new Date(),t(v.base),t(v.periodo),t(v.lugar),t(v.ldir),la,lo,t(v.loc),t(v.per)])}return true}
 finally{L.releaseLock()}}
const eventos_=mun=>{const s=sh_("Eventos");return s&&s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,21).getValues().filter(e=>e[0]!==""&&(e[1]==="*"||e[1]===mun)):[]};

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
 /* Ubicación: GPS en el domicilio, o coordenadas escritas a mano, o se ubica después por la dirección (cada madrugada). */
 const mA=Number(r.latM),mO=Number(r.lngM),man=!conGps&&enMx_(mA,mO);
 const lat=conGps?r.lat:man?mA:"",lng=conGps?r.lng:man?mO:"",ori=conGps?"GPS":man?"Escrita a mano":(r.direccion||r.colonia?"Pendiente":"");
 const mun=q.mun,ts=new Date(),nombre=String(r.nombre).trim(),grupos=(r.grupos||[]).join("; ");
 const pd=sh_("Padron"),claves=pd.getLastRow()>1?pd.getRange(2,1,pd.getLastRow()-1,1).getValues().map(x=>x[0]):[];
 const base=[r.localidad||"",r.tel||"",r.direccion||"",lat,lng,grupos,ts];
 let clave,folio="",estado=curp?"Completa":"Incompleta";
 if(curp){
  clave=curp;
  if(claves.indexOf(curp)<0)pd.appendRow([curp,curp,"",nombre,mun,...base,"Completo",nac,sexo,...ext,ori,""]);
 }else{
  folio="SC-"+String(r.id).slice(0,8).toUpperCase();clave=folio;
  if(claves.indexOf(folio)<0)pd.appendRow([folio,null,folio,nombre,mun,...base,"Incompleto",nac,sexo,...ext,ori,""]);
 }
 if(r.programa){const ap=sh_("Apoyos"),av=ap.getLastRow()>1?ap.getRange(2,2,ap.getLastRow()-1,14).getValues():[];
  /* Repetido = misma persona, mismo programa y año. NO cuenta como repetido otra entrega o periodo del mismo apoyo
     periódico (eventos de la misma familia: base). Sí cuenta recibir dos veces la misma entrega. */
  const fam={};eventos_(q.mun).forEach(e=>fam[String(e[0])]=String(e[13]||"")||String(e[0]));const F=x=>x?fam[x]||x:"";
  const k=clave+"|"+String(r.programa).toLowerCase()+"|"+yr_(r.fecha),ide=String(r.evento||"");let aviso="";
  if(av.some(a=>a[0]+"|"+String(a[2]).toLowerCase()+"|"+yr_(a[6])===k&&(!ide||String(a[13])===ide||F(String(a[13]))!==F(ide)))){aviso="Duplicado probable: mismo programa y año";estado="Revisar"}
  /* El apoyo se ubica donde se entregó: el lugar del evento si tiene, si no el domicilio. */
  const eLa=ev&&ev[17]!==""&&ev[17]!=null?ev[17]:lat,eLo=ev&&ev[18]!==""&&ev[18]!=null?ev[18]:lng;
  ap.appendRow([r.id,clave,mun,r.programa,r.eje||"",r.area||"",r.monto||"",r.fecha||"",eLa,eLo,ben,apo,r.id,aviso,r.evento||"",r.tipo||"",r.canal||""])
 }
 sc.appendRow([r.id,ts,q.id,mun,estado,curp,folio,nombre,r.localidad||"",r.tel||"",r.direccion||"",lat,lng,grupos,
  r.programa||"",r.eje||"",r.area||"",r.monto||"",r.fecha||"",ben,apo,ine,r.notas||"",motivo,nac,sexo,r.evento||"",r.tipo||"",r.canal||"",...ext,iner,ori]);
 return{ok:true}}
 finally{L.releaseLock()}}
