
  let diccionarioNombres = [];
  let textoSuperFetchGuardado = "";

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
  // PASO 0: DESCARGAR DICCIONARIO AL INICIAR
  // ==========================================
  // ==========================================
  // PASO 0: DESCARGAR DICCIONARIO AL INICIAR (CON CACHÉ DE 24 HORAS)
  // ==========================================
  // ==========================================
  // PASO 0: DESCARGAR DICCIONARIO AL INICIAR (CON CACHÉ DE 24 HORAS)
  // ==========================================
  window.onload = async function() {
      const CACHE_KEY = "diccionario_ce_mined";
      const CACHE_TIME_KEY = "diccionario_ce_mined_time";
      const HORAS_CACHE = 24;
      const limiteTiempo = HORAS_CACHE * 60 * 60 * 1000; // 24 horas en milisegundos
      const tiempoActual = Date.now();

      // 1. Revisar si hay caché válida
      const cacheGuardada = localStorage.getItem(CACHE_KEY);
      const tiempoGuardado = localStorage.getItem(CACHE_TIME_KEY);

      if (cacheGuardada && tiempoGuardado && (tiempoActual - tiempoGuardado < limiteTiempo)) {
          diccionarioNombres = JSON.parse(cacheGuardada);
          document.getElementById("estadoDiccionario").innerHTML = `<span class="estado-ok">⚡ Diccionario cargado desde caché local (${diccionarioNombres.length} CEs).</span>`;
          document.getElementById("ceInput").disabled = false;
          document.getElementById("btnBuscar").disabled = false;
          document.getElementById("ceInput").focus();
          
          // Verificar si venimos redirigidos desde el mapa
          verificarBusquedaAutomatica();
          return; // Salimos de la función, no hacemos la petición a Power BI
      }

      // 2. Si no hay caché o ya caducó, descargamos de Power BI
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

              // GUARDAR EN CACHÉ
              localStorage.setItem(CACHE_KEY, JSON.stringify(diccionarioNombres));
              localStorage.setItem(CACHE_TIME_KEY, tiempoActual.toString());

              document.getElementById("estadoDiccionario").innerHTML = `<span class="estado-ok">✅ Diccionario descargado y guardado con ${diccionarioNombres.length} Centros Escolares.</span>`;
              document.getElementById("ceInput").disabled = false;
              document.getElementById("btnBuscar").disabled = false;
              document.getElementById("ceInput").focus();

              // Verificar si venimos redirigidos desde el mapa
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
    // 1. Leemos los parámetros que vienen en la URL
    const urlParams = new URLSearchParams(window.location.search);
    let codigoBuscado = urlParams.get('ce') || urlParams.get('codigo');

    // 2. Respaldos: si no venía en la URL, revisamos la memoria temporal
    if (!codigoBuscado) {
      codigoBuscado = sessionStorage.getItem("buscarCodigoAutomatico");
      sessionStorage.removeItem("buscarCodigoAutomatico");
    }

    // 3. Si encontramos un código, llenamos el input y ejecutamos la búsqueda
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

    // Traducir el código corto al nombre oficial largo
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

    // Skeletons mientras carga
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

  // --- INTERFAZ ---
  function agregarFilaUI(titulo, valor, contenedor, esEnlace = false) {
    const sinDato = (valor === "Dato no disponible" || valor === "Matrícula no encontrada");
    const valorSeguro = String(valor).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    let botonesHTML = `<button class="btn-copiar" onclick="copiarAlPortapapeles('${valorSeguro}')">Copiar</button>`;

    if (esEnlace && !sinDato && valor.includes("http")) {
      const urlSegura = valor.replace(/"/g, "&quot;");
      
      // Extraemos las coordenadas del enlace
      const coords = extraerCoordenadas(valor);
      let botonCoordsHTML = "";

      // Si se lograron extraer coordenadas, generamos el nuevo botón
      if (coords) {
        botonCoordsHTML = `<button class="btn-copiar btn-coords" onclick="copiarAlPortapapeles('${coords}')">📍 Copiar Coordenadas</button>`;
      }

      botonesHTML = `
        <a href="${urlSegura}" target="_blank" rel="noopener" class="btn-link">Abrir ruta</a>
        <button class="btn-copiar" onclick="copiarAlPortapapeles('${valorSeguro}')">Copiar link</button>
        ${botonCoordsHTML}`;
    }

    const claseValor = sinDato ? "valor no-disp" : "valor";

    contenedor.innerHTML += `
      <div class="fila-dato">
        <div class="texto-dato"><strong>${titulo}</strong><span class="${claseValor}">${escaparHTML(String(valor))}</span></div>
        <div class="acciones-btn">${botonesHTML}</div>
      </div>`;
  }

  function escaparHTML(str) {
    const div = document.createElement("div");
    div.innerText = str;
    return div.innerHTML;
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
        .then(() => mostrarToast(`Copiado: ${texto}`))
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
        mostrarToast(mensajePersonalizado ? mensajePersonalizado : `Copiado: ${texto}`);
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
  // AUTOCOMPLETADO PROGRESIVO (estilo PowerBI)
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

  // Extrae 'latitud, longitud' directamente desde la URL de Google Maps o Waze
  function extraerCoordenadas(url) {
    if (!url || typeof url !== "string") return null;
    const regexWaze = /ll=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const regexMaps = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const regexMapsQ = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
    
    const match = url.match(regexWaze) || url.match(regexMaps) || url.match(regexMapsQ);
    if (match) {
      return `${match[1]}, ${match[2]}`; // Retorna formato: "13.7941, -88.8965"
    }
    return null;
  }