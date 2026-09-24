let diccionarioNombres = [];
let textoSuperFetchGuardado = "";
let datosCEActual = {}; // Almacena los datos extraídos en memoria

const HEADERS_API = {
  "Accept": "application/json, text/plain, */*",
  "X-PowerBI-ResourceKey": "d959e760-42b8-4e9a-8a41-de0d6ca8f8ce",
  "Content-Type": "application/json;charset=UTF-8"
};
const URL_API = "https://wabi-paas-1-scus-api.analysis.windows.net/public/reports/querydata?synchronous=true";
const DATASET_ID = "1286915e-8f7f-487f-bae3-73a9e488c456";
const REPORT_ID = "243201a2-4a9e-4f70-9997-ed23d079ba3f";
const MODEL_ID = 3759890;

const CAMPOS = [
  { titulo: "Código de infraestructura", tipo: "estandar", entidad: "CE_2024", propiedad: "Código", nombre: "Sum(CE_2024.Código)", visualId: "856bb84f10fd156985da" },
  { titulo: "Nombre del centro educativo", tipo: "estandar", entidad: "CE_2024", propiedad: "Nombre del Centro Educativo", nombre: "CE_2024.Nombre del Centro Educativo", visualId: "b93ea371a1f3bb83f326" },
  { titulo: "Turno", tipo: "medida", entidad: "Turnos", propiedad: "Turno Unificado", nombre: "Turnos.Turno Unificado", visualId: "7e327bf503501c9516eb" },
  { titulo: "Departamento", tipo: "estandar", entidad: "CE_2024", propiedad: "Departamento", nombre: "CE_2024.Departamento", visualId: "6cdf5b34f04fd237b4dc" },
  { titulo: "Distrito", tipo: "estandar", entidad: "CE_2024", propiedad: "Distrito", nombre: "CE_2024.Distrito", visualId: "b917b9f95449267164bb" },
  { titulo: "Municipio", tipo: "estandar", entidad: "CE_2024", propiedad: "Municipio", nombre: "CE_2024.Municipio", visualId: "17095abaaae058a6f737" },
  { titulo: "Dirección", tipo: "estandar", entidad: "CE_2024", propiedad: "Dirección", nombre: "CE_2024.Dirección", visualId: "0118ca5223a73939f738" },
  { titulo: "Director/a o encargado/a", tipo: "estandar", entidad: "CE_2024", propiedad: "Director", nombre: "CE_2024.Director", visualId: "75502b5490740a180fe1" },
  { titulo: "Teléfono", tipo: "medida", entidad: "CE_2024", propiedad: "Telefono Concatenado", nombre: "CE_2024.Telefono Concatenado", visualId: "e816dcdbab7208ab4e3d", insertarMatriculaDespues: true },
  { titulo: "Distancia", tipo: "estandar", entidad: "CE_2024", propiedad: "Distancia", nombre: "CE_2024.Distancia", visualId: "0b1fa04b30a5055ab20a" },
  { titulo: "En rango", tipo: "estandar", entidad: "CE_2024", propiedad: "EnRango", nombre: "CE_2024.EnRango", visualId: "1600f9a53b0180267b01" },
  { titulo: "Google Maps", tipo: "estandar", entidad: "CE_2024", propiedad: "GoogleMapsLink", nombre: "Min(CE_2024.GoogleMapsLink)", visualId: "b28aa4dcfa84d1cc5a9d", esEnlace: true },
  { titulo: "Waze", tipo: "estandar", entidad: "CE_2024", propiedad: "WazeLink", nombre: "Min(CE_2024.WazeLink)", visualId: "fb37bcfcc6e9b1c54a31", esEnlace: true }
];

const CAMPO_MATRICULA = { titulo: "Matrícula (Niñas / Niños / Total)", visualId: "a02129f7adc9b41376c6" };
const CAMPO_SUPER_FETCH = { visualId: "d05d6442e975bcb494d7" };

// ==========================================
// PASO 0: DESCARGAR DICCIONARIO AL INICIAR (CON CACHÉ DE 24 HORAS)
// ==========================================
window.onload = async function() {
    const CACHE_KEY = "diccionario_ce_mined";
    const CACHE_TIME_KEY = "diccionario_ce_mined_time";
    const HORAS_CACHE = 24;
    const limiteTiempo = HORAS_CACHE * 60 * 60 * 1000;
    const tiempoActual = Date.now();

    const cacheGuardada = localStorage.getItem(CACHE_KEY);
    const tiempoGuardado = localStorage.getItem(CACHE_TIME_KEY);

    if (cacheGuardada && tiempoGuardado && (tiempoActual - tiempoGuardado < limiteTiempo)) {
        diccionarioNombres = JSON.parse(cacheGuardada);
        document.getElementById("estadoDiccionario").innerHTML = `<span class="estado-ok">⚡ Diccionario cargado desde caché local (${diccionarioNombres.length} CEs).</span>`;
        document.getElementById("ceInput").disabled = false;
        document.getElementById("btnBuscar").disabled = false;
        document.getElementById("ceInput").focus();
        
        verificarBusquedaAutomatica();
        return;
    }

    document.getElementById("estadoDiccionario").innerHTML = `⏳ Descargando diccionario actualizado desde el MINED...`;
    const bodyDiccionario = `{"version":"1.0.0","queries":[{"Query":{"Commands":[{"SemanticQueryDataShapeCommand":{"Query":{"Version":2,"From":[{"Name":"c","Entity":"CE_2024","Type":0}],"Select":[{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Infra_y_Nombre_CE"},"Name":"CE_2024.Infra_y_Nombre_CE"}],"OrderBy":[{"Direction":1,"Expression":{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Infra_y_Nombre_CE"}}}]},\"Binding\":{\"Primary\":{\"Groupings\":[{\"Projections\":[0]}]},\"DataReduction\":{\"DataVolume\":3,\"Primary\":{\"Top\":{\"Count\":30000}}},\"Version\":1},\"ExecutionMetricsKind\":1}}]},\"ApplicationContext\":{\"DatasetId\":\"1286915e-8f7f-487f-bae3-73a9e488c456\",\"Sources\":[{\"ReportId\":\"243201a2-4a9e-4f70-9997-ed23d079ba3f\",\"VisualId\":\"9e229e8ff2abde49259a\"}]}}],\"cancelQueries\":[],\"modelId\":3759890}`;

    try {
        const response = await fetch(URL_API, { headers: HEADERS_API, body: bodyDiccionario, method: "POST", mode: "cors" });
        const textoCrudo = await response.text();

        const regexColegios = /"\d{4,5}\s+[^"]+"/g;
        const coincidencias = textoCrudo.match(regexColegios);

        if (coincidencias && coincidencias.length > 0) {
            diccionarioNombres = coincidencias.map(texto => texto.replace(/"/g, ''));
            diccionarioNombres = [...new Set(diccionarioNombres)];

            localStorage.setItem(CACHE_KEY, JSON.stringify(diccionarioNombres));
            localStorage.setItem(CACHE_TIME_KEY, tiempoActual.toString());

            document.getElementById("estadoDiccionario").innerHTML = `<span class="estado-ok">✅ Diccionario descargado y guardado con ${diccionarioNombres.length} Centros Escolares.</span>`;
            document.getElementById("ceInput").disabled = false;
            document.getElementById("btnBuscar").disabled = false;
            document.getElementById("ceInput").focus();

            verificarBusquedaAutomatica();
        } else {
            document.getElementById("estadoDiccionario").innerHTML = `<span class="error">❌ El servidor no devolvió la lista. Puede que la sesión haya caducado.</span>`;
        }
    } catch (error) {
        document.getElementById("estadoDiccionario").innerHTML = `<span class="error">❌ Error de conexión al descargar el diccionario.</span>`;
    }
};

// ==========================================
// CONEXIÓN ENTRE PÁGINAS (MAPA -> MAESTRO)
// ==========================================
function verificarBusquedaAutomatica() {
  const urlParams = new URLSearchParams(window.location.search);
  let codigoBuscado = urlParams.get('ce') || urlParams.get('codigo');

  if (!codigoBuscado) {
    codigoBuscado = sessionStorage.getItem("buscarCodigoAutomatico");
    sessionStorage.removeItem("buscarCodigoAutomatico");
  }

  if (codigoBuscado) {
    document.getElementById("ceInput").value = codigoBuscado;
    ejecutarBusquedaMaestra();
  }
}

async function ejecutarBusquedaMaestra() {
  const codigoCorto = document.getElementById("ceInput").value.trim();
  const estadoText = document.getElementById("estadoText");
  const dashboardCE = document.getElementById("dashboardCE");
  const listaDetalles = document.getElementById("listaDetalles");
  const btnBuscar = document.getElementById("btnBuscar");
  const previewBox = document.getElementById("previewSuperText");

  if (!codigoCorto) {
    estadoText.innerText = "Escribe el código del Centro Educativo antes de buscar.";
    estadoText.className = "error";
    return;
  }

  const nombreCE = diccionarioNombres.find(nombre => nombre.startsWith(codigoCorto));

  if (!nombreCE) {
      estadoText.innerText = `❌ No se encontró ningún Centro Escolar que inicie con el código "${codigoCorto}".`;
      estadoText.className = "error";
      dashboardCE.style.display = "none";
      return;
  }

  estadoText.innerHTML = `Detectado: <strong>${nombreCE}</strong><br>Consultando el dataset en paralelo…`;
  estadoText.className = "";
  dashboardCE.style.display = "none";
  listaDetalles.innerHTML = "";
  previewBox.innerText = "Cargando bloque…";
  btnBuscar.disabled = true;

  // Reiniciamos objeto temporal de datos
  datosCEActual = {};

  for (let i = 0; i < CAMPOS.length + 1; i++) {
    listaDetalles.innerHTML += `<div class="skeleton"></div>`;
  }

  try {
    const peticionesCampos = CAMPOS.map(campo => hacerPeticion(generarBodyCampo(campo, nombreCE)));
    const peticionMatricula = hacerPeticion(generarBodyMatricula(nombreCE));
    const peticionSuperFetch = hacerPeticion(generarBodySuperFetch(nombreCE));

    const [resultadosCampos, respMatricula, respSuperFetch] = await Promise.all([
      Promise.all(peticionesCampos),
      peticionMatricula,
      peticionSuperFetch
    ]);

    listaDetalles.innerHTML = "";

    const textoMatricula = extraerValorMatricula(respMatricula);

    resultadosCampos.forEach((resp, i) => {
      const campo = CAMPOS[i];
      const valor = extraerValorEstandar(resp);

      // Guardamos la respuesta directamente en memoria por título de campo
      datosCEActual[campo.titulo] = (valor === "Dato no disponible") ? "" : valor;

      agregarFilaUI(campo.titulo, valor, listaDetalles, !!campo.esEnlace);
      if (campo.insertarMatriculaDespues) {
        agregarFilaUI(CAMPO_MATRICULA.titulo, textoMatricula, listaDetalles);
      }
    });

    textoSuperFetchGuardado = extraerValorEstandar(respSuperFetch);
    previewBox.innerText = textoSuperFetchGuardado;

    estadoText.innerText = "";
    dashboardCE.style.display = "grid";

  } catch (error) {
    console.error(error);
    estadoText.innerText = "Hubo un error de conexión con Power BI. Intenta de nuevo.";
    estadoText.className = "error";
  } finally {
    btnBuscar.disabled = false;
  }
}

// --- EXTRACCIÓN JSON ---
function extraerValorEstandar(data) {
  try {
    const m0 = data.results[0].result.data.dsr.DS[0].PH[0].DM0[0].M0;
    if (m0 === undefined || m0 === null || m0 === "") return "Dato no disponible";
    return String(m0);
  } catch (e) { return "Dato no disponible"; }
}

function extraerValorMatricula(data) {
  try {
    const dm0 = data.results[0].result.data.dsr.DS[0].PH[0].DM0[0];
    if (dm0.C && dm0.C.length >= 3) return `Niñas: ${dm0.C[0]} | Niños: ${dm0.C[1]} | Total: ${dm0.C[2]}`;
    if (dm0.M0 !== undefined) return `Niñas: ${dm0.M0} | Niños: ${dm0.M1} | Total: ${dm0.M2}`;
    return "Matrícula no encontrada";
  } catch (e) { return "Dato no disponible"; }
}

// Renderiza cada fila de datos en la interfaz
// Renderiza cada fila de datos en la interfaz con botones visuales
function agregarFilaUI(titulo, valor, contenedor, esEnlace = false) {
  const sinDato = (valor === "Dato no disponible" || valor === "Matrícula no encontrada");
  const valorSeguro = String(valor).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  let botonesHTML = `<button class="btn-copiar" onclick="copiarAlPortapapeles('${valorSeguro}')">Copiar</button>`;

  if (esEnlace && !sinDato && valor.includes("http")) {
    const urlSegura = valor.replace(/"/g, "&quot;");
    const coords = extraerCoordenadas(valor);
    let botonCoordsHTML = "";

    if (coords) {
      botonCoordsHTML = `<button class="btn-copiar btn-coords" onclick="copiarAlPortapapeles('${coords}')">📍 Coordenadas</button>`;
    }

    // Definición de Íconos SVG
    const iconoMaps = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
    const iconoWaze = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.5 10c0-4.14-3.36-7.5-7.5-7.5S3.5 5.86 3.5 10c0 1.62.51 3.12 1.39 4.35l-1.04 3.12 3.25-.82C8.28 17.41 9.84 17.8 11 17.8c4.14 0 7.5-3.36 7.5-7.8zM8.5 9c.83 0 1.5.67 1.5 1.5S9.33 12 8.5 12 7 11.33 7 10.5 7.67 9 8.5 9zm5 0c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5z"/></svg>`;

    // Determinar estilo según el servicio de mapas
    const esWaze = titulo.toLowerCase().includes("waze");
    const nombreApp = esWaze ? "Waze" : "Google Maps";
    const iconoApp = esWaze ? iconoWaze : iconoMaps;
    const claseEstilo = esWaze ? "btn-app-waze" : "btn-app-maps";

    botonesHTML = `
      <a href="${urlSegura}" target="_blank" rel="noopener" class="btn-link-app ${claseEstilo}" title="Abrir en ${nombreApp}">
        ${iconoApp} <span>${nombreApp}</span>
      </a>
      <button class="btn-copiar" onclick="copiarAlPortapapeles('${valorSeguro}')">Copiar link</button>
      ${botonCoordsHTML}`;
  }

  const claseValor = sinDato ? "valor no-disp" : "valor";

  contenedor.innerHTML += `
    <div class="fila-dato">
      <div class="texto-dato">
        <strong>${titulo}</strong>
        <span class="${claseValor}">${esEnlace && !sinDato ? "Ubicación Geográfica" : escapingHTML(String(valor))}</span>
      </div>
      <div class="acciones-btn">${botonesHTML}</div>
    </div>`;
}

function escapingHTML(str) {
  const div = document.createElement("div");
  div.innerText = str;
  return div.innerHTML;
}

function escaparHTML(str) {
  const div = document.createElement("div");
  div.innerText = str;
  return div.innerHTML;
}

// En copiarFilaExcel() dentro de index.js:
function copiarFilaExcel() {
  // 1. Extraemos el código de infraestructura y los demás datos guardados en memoria
  const infra = datosCEActual["Código de infraestructura"] || "";
  const nombre = datosCEActual["Nombre del centro educativo"] || "";
  const departamento = datosCEActual["Departamento"] || "";
  const direccion = datosCEActual["Dirección"] || "";
  const municipio = datosCEActual["Municipio"] || "";

  // 2. Extraemos la zona (RURAL / URBANA) buscando en la Ficha Resumen (SuperFetch)
  let zona = "";
  if (textoSuperFetchGuardado) {
    const matchZona = textoSuperFetchGuardado.match(/\b(RURAL|URBANA)\b/i);
    if (matchZona) {
      zona = matchZona[1].toUpperCase();
    }
  }

  // 3. Limpiamos saltos de línea y espacios extras
  const limpiar = (t) => String(t).replace(/[\r\n\t]+/g, " ").trim();

  // 4. Cadena horizontal: Infra (Col B) -> Nombre (Col C) -> Dep (Col D) -> Dir (Col E) -> Mun (Col F) -> Zona (Col G)
  const filaFormateada = `${limpiar(infra)}\t${limpiar(nombre)}\t${limpiar(departamento)}\t${limpiar(direccion)}\t${limpiar(municipio)}\t${limpiar(zona)}`;

  copiarAlPortapapeles(filaFormateada);
}

// --- MOTOR DE PETICIONES ---
async function hacerPeticion(bodyString) {
  const response = await fetch(URL_API, {
    headers: HEADERS_API,
    body: bodyString,
    method: "POST",
    mode: "cors",
    credentials: "omit"
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}

// --- GENERADORES DE CUERPO DE PETICIÓN ---
function generarBodyCampo(campo, nombreCE) {
  const selectBlock = campo.tipo === "medida"
    ? `{"Measure":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"${campo.propiedad}"},"Name":"${campo.nombre}"}`
    : `{"Aggregation":{"Expression":{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"${campo.propiedad}"}},"Function":3},"Name":"${campo.nombre}"}`;

  const entidadTurno = campo.entidad === "Turnos"
    ? `{"Name":"c","Entity":"Turnos","Type":0},{"Name":"c1","Entity":"CE_2024","Type":0}`
    : `{"Name":"c","Entity":"${campo.entidad}","Type":0}`;

  const whereSource = campo.entidad === "Turnos" ? "c1" : "c";

  return `{"version":"1.0.0","queries":[{"Query":{"Commands":[{"SemanticQueryDataShapeCommand":{"Query":{"Version":2,"From":[${entidadTurno}],"Select":[${selectBlock}],"Where":[{"Condition":{"In":{"Expressions":[{"Column":{"Expression":{"SourceRef":{"Source":"${whereSource}"}},"Property":"Infra_y_Nombre_CE"}}],"Values":[[{"Literal":{"Value":"'${nombreCE}'"}}]]}}}]},"Binding":{"Primary":{"Groupings":[{"Projections":[0],"Subtotal":1}]},"Version":1},"ExecutionMetricsKind":1}}]},"ApplicationContext":{"DatasetId":"${DATASET_ID}","Sources":[{"ReportId":"${REPORT_ID}","VisualId":"${campo.visualId}"}]}}],"cancelQueries":[],"modelId":${MODEL_ID}}`;
}

function generarBodyMatricula(nombreCE) {
  return `{"version":"1.0.0","queries":[{"Query":{"Commands":[{"SemanticQueryDataShapeCommand":{"Query":{"Version":2,"From":[{"Name":"c","Entity":"CE_ESTADÍSTICAS","Type":0},{"Name":"c1","Entity":"CE_2024","Type":0}],"Select":[{"Aggregation":{"Expression":{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"MATRICULA_NIÑAS"}},"Function":0},"Name":"Sum(CE_ESTADÍSTICAS.MATRICULA_NIÑAS)"},{"Aggregation":{"Expression":{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"MATRICULA_NIÑOS"}},"Function":0},"Name":"Sum(CE_ESTADÍSTICAS.MATRICULA_NIÑOS)"},{"Aggregation":{"Expression":{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"TOTAL_MATRICULA"}},"Function":0},"Name":"Sum(CE_ESTADÍSTICAS.TOTAL_MATRICULA)"}],"Where":[{"Condition":{"In":{"Expressions":[{"Column":{"Expression":{"SourceRef":{"Source":"c1"}},"Property":"Infra_y_Nombre_CE"}}],"Values":[[{"Literal":{"Value":"'${nombreCE}'"}}]]}}}]},"Binding":{"Primary":{"Groupings":[{"Projections":[0,1,2]}]},"Version":1},"ExecutionMetricsKind":1}}]},"ApplicationContext":{"DatasetId":"${DATASET_ID}","Sources":[{"ReportId":"${REPORT_ID}","VisualId":"${CAMPO_MATRICULA.visualId}"}]}}],"cancelQueries":[],"modelId":${MODEL_ID}}`;
}

function generarBodySuperFetch(nombreCE) {
  return `{"version":"1.0.0","queries":[{"Query":{"Commands":[{"SemanticQueryDataShapeCommand":{"Query":{"Version":2,"From":[{"Name":"c","Entity":"CE_2024","Type":0}],"Select":[{"Aggregation":{"Expression":{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"COPIAR_DATOS"}},"Function":3},"Name":"Min(CE_2024.COPIAR_DATOS)"}],"Where":[{"Condition":{"In":{"Expressions":[{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Infra_y_Nombre_CE"}}],"Values":[[{"Literal":{"Value":"'${nombreCE}'"}}]]}}}]},"Binding":{"Primary":{"Groupings":[{"Projections":[0]}]},"Version":1},"ExecutionMetricsKind":1}}]},"ApplicationContext":{"DatasetId":"${DATASET_ID}","Sources":[{"ReportId":"${REPORT_ID}","VisualId":"${CAMPO_SUPER_FETCH.visualId}"}]}}],"cancelQueries":[],"modelId":${MODEL_ID}}`;
}

// --- ACCIONES DE USUARIO ---
function copiarAlPortapapeles(texto) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(texto)
      .then(() => mostrarToast(`Copiado al portapapeles`))
      .catch(() => fallbackCopiar(texto));
  } else {
    fallbackCopiar(texto);
  }
}

function copiarSuperFetch() {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(textoSuperFetchGuardado)
      .then(() => mostrarToast("Ficha completa copiada"))
      .catch(() => fallbackCopiar(textoSuperFetchGuardado, "Ficha completa copiada"));
  } else {
    fallbackCopiar(textoSuperFetchGuardado, "Ficha completa copiada");
  }
}

function fallbackCopiar(texto, mensajePersonalizado) {
  const textArea = document.createElement("textarea");
  textArea.value = texto;

  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const exitoso = document.execCommand('copy');
    if (exitoso) {
      mostrarToast(mensajePersonalizado ? mensajePersonalizado : `Copiado al portapapeles`);
    } else {
      mostrarToast("❌ Error al copiar");
    }
  } catch (err) {
    mostrarToast("❌ El navegador bloqueó la copia");
  }

  document.body.removeChild(textArea);
}

function mostrarToast(mensaje) {
  const toast = document.getElementById("toast");
  toast.innerText = mensaje;
  toast.className = "show";
  setTimeout(function () { toast.className = toast.className.replace("show", ""); }, 2500);
}

// ==========================================
// AUTOCOMPLETADO PROGRESIVO
// ==========================================
const MAX_SUGERENCIAS = 40;
let sugerenciasActuales = [];
let indiceActivo = -1;

const inputCE = document.getElementById("ceInput");
const cajaSugerencias = document.getElementById("sugerencias");

function formatearSugerencia(nombre) {
  const espacio = nombre.indexOf(" ");
  if (espacio === -1) return `<span class="cod">${nombre}</span>`;
  const codigo = nombre.slice(0, espacio);
  const resto = nombre.slice(espacio + 1);
  return `<span class="cod">${codigo}</span><span class="resto">${resto}</span>`;
}

function normalizarTexto(texto) {
  if (!texto) return "";
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function actualizarSugerencias() {
  const texto = inputCE.value.trim();
  indiceActivo = -1;

  const query = normalizarTexto(texto);

  if (!query || !diccionarioNombres.length) {
    cajaSugerencias.classList.remove("show");
    cajaSugerencias.innerHTML = "";
    sugerenciasActuales = [];
    return;
  }

  const coincidencias = diccionarioNombres.filter(nombre => {
    const nombreNormalizado = normalizarTexto(nombre);
    return nombreNormalizado.includes(query);
  });

  sugerenciasActuales = coincidencias.slice(0, MAX_SUGERENCIAS);

  if (sugerenciasActuales.length === 0) {
    cajaSugerencias.innerHTML = `<div class="sug-info">Sin coincidencias para "${texto}"</div>`;
    cajaSugerencias.classList.add("show");
    return;
  }

  let html = "";
  if (coincidencias.length > MAX_SUGERENCIAS) {
    html += `<div class="sug-info">Mostrando ${MAX_SUGERENCIAS} de ${coincidencias.length} — sigue escribiendo para acotar</div>`;
  }

  sugerenciasActuales.forEach((nombre, i) => {
    html += `<div class="sugerencia-item" data-index="${i}" onclick="seleccionarSugerencia(${i})">${formatearSugerencia(nombre)}</div>`;
  });

  cajaSugerencias.innerHTML = html;
  cajaSugerencias.classList.add("show");
}

function seleccionarSugerencia(i) {
  const nombre = sugerenciasActuales[i];
  if (!nombre) return;
  const espacio = nombre.indexOf(" ");
  const codigo = espacio === -1 ? nombre : nombre.slice(0, espacio);
  inputCE.value = codigo;
  cajaSugerencias.classList.remove("show");
  cajaSugerencias.innerHTML = "";
  sugerenciasActuales = [];
  ejecutarBusquedaMaestra();
}

function resaltarActiva() {
  const items = cajaSugerencias.querySelectorAll(".sugerencia-item");
  items.forEach((el, i) => el.classList.toggle("activa", i === indiceActivo));
  if (indiceActivo >= 0 && items[indiceActivo]) {
    items[indiceActivo].scrollIntoView({ block: "nearest" });
  }
}

inputCE.addEventListener("input", actualizarSugerencias);

inputCE.addEventListener("keydown", function (e) {
  const listaVisible = cajaSugerencias.classList.contains("show") && sugerenciasActuales.length > 0;

  if (listaVisible && e.key === "ArrowDown") {
    e.preventDefault();
    indiceActivo = Math.min(indiceActivo + 1, sugerenciasActuales.length - 1);
    resaltarActiva();
    return;
  }
  if (listaVisible && e.key === "ArrowUp") {
    e.preventDefault();
    indiceActivo = Math.max(indiceActivo - 1, 0);
    resaltarActiva();
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    if (listaVisible && indiceActivo >= 0) {
      seleccionarSugerencia(indiceActivo);
    } else {
      cajaSugerencias.classList.remove("show");
      ejecutarBusquedaMaestra();
    }
    return;
  }
  if (e.key === "Escape") {
    cajaSugerencias.classList.remove("show");
  }
});

document.addEventListener("click", function (e) {
  if (!cajaSugerencias.contains(e.target) && e.target !== inputCE) {
    cajaSugerencias.classList.remove("show");
  }
});

// Extrae 'latitud, longitud' desde enlaces de Google Maps, Waze o enlaces genéricos de mapa
function extraerCoordenadas(url) {
  if (!url || typeof url !== "string") return null;
  const regexWaze = /ll=(-?\d+\.\d+),(-?\d+\.\d+)/;
  const regexMaps = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
  const regexMapsQ = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
  const regexGeneric = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
  
  const match = url.match(regexWaze) || url.match(regexMaps) || url.match(regexMapsQ) || url.match(regexGeneric);
  if (match) {
    return `${match[1]}, ${match[2]}`; // Formato: "13.7941, -88.8965"
  }
  return null;
}