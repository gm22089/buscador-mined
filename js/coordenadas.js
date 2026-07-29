
  let diccionarioLugares = []; // Guardará objetos: { nombre: "APANECA", tipo: "Distrito" }

  const HEADERS_API = {
    "Accept": "application/json, text/plain, */*",
    "X-PowerBI-ResourceKey": "d959e760-42b8-4e9a-8a41-de0d6ca8f8ce",
    "Content-Type": "application/json;charset=UTF-8"
  };
  const URL_API = "https://wabi-paas-1-scus-api.analysis.windows.net/public/reports/querydata?synchronous=true";
  const DATASET_ID = "1286915e-8f7f-487f-bae3-73a9e488c456";
  const REPORT_ID = "243201a2-4a9e-4f70-9997-ed23d079ba3f";
  const MODEL_ID = 3759890;
  const MAX_RESULTADOS = 3000;

  // ==========================================
  // PASO 0: DESCARGAR MUNICIPIOS Y DISTRITOS
  // ==========================================// ==========================================
  // PASO 0: DESCARGAR MUNICIPIOS Y DISTRITOS (CON CACHÉ DE 24 HORAS)
  // ==========================================
  window.onload = async function () {
    const CACHE_ZONAS_KEY = "diccionario_zonas_mined";
    const CACHE_ZONAS_TIME = "diccionario_zonas_time";
    const HORAS_CACHE = 24;
    const limiteTiempo = HORAS_CACHE * 60 * 60 * 1000;
    const tiempoActual = Date.now();

    // 1. Revisar caché local
    const cacheGuardada = localStorage.getItem(CACHE_ZONAS_KEY);
    const tiempoGuardado = localStorage.getItem(CACHE_ZONAS_TIME);

    if (cacheGuardada && tiempoGuardado && (tiempoActual - tiempoGuardado < limiteTiempo)) {
        diccionarioLugares = JSON.parse(cacheGuardada);
        document.getElementById("estadoDiccionario").innerHTML = `<span class="estado-ok">⚡ Zonas cargadas desde caché local. Escribe una zona para empezar.</span>`;
        document.getElementById("lugarInput").disabled = false;
        document.getElementById("btnBuscar").disabled = false;
        document.getElementById("lugarInput").focus();
        return;
    }

    // 2. Si no hay caché, descargar de Power BI
    document.getElementById("estadoDiccionario").innerHTML = `⏳ Descargando listado de lugares actualizado desde el MINED...`;
    const bodyMunicipios = `{"version":"1.0.0","queries":[{"Query":{"Commands":[{"SemanticQueryDataShapeCommand":{"Query":{"Version":2,"From":[{"Name":"c","Entity":"CE_2024","Type":0}],"Select":[{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Municipio"},"Name":"CE_2024.Municipio"}],"OrderBy":[{"Direction":1,"Expression":{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Municipio"}}}]},"Binding":{"Primary":{"Groupings":[{"Projections":[0]}]},"DataReduction":{"DataVolume":3,"Primary":{"Top":{"Count":30000}}},"Version":1},"ExecutionMetricsKind":1}}]},"ApplicationContext":{"DatasetId":"${DATASET_ID}","Sources":[{"ReportId":"${REPORT_ID}","VisualId":"17095abaaae058a6f737"}]}}],"cancelQueries":[],"modelId":${MODEL_ID}}`;
    const bodyDistritos = `{"version":"1.0.0","queries":[{"Query":{"Commands":[{"SemanticQueryDataShapeCommand":{"Query":{"Version":2,"From":[{"Name":"c","Entity":"CE_2024","Type":0}],"Select":[{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Distrito"},"Name":"CE_2024.Distrito"}],"OrderBy":[{"Direction":1,"Expression":{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Distrito"}}}]},"Binding":{"Primary":{"Groupings":[{"Projections":[0]}]},"DataReduction":{"DataVolume":3,"Primary":{"Top":{"Count":30000}}},"Version":1},"ExecutionMetricsKind":1}}]},"ApplicationContext":{"DatasetId":"${DATASET_ID}","Sources":[{"ReportId":"${REPORT_ID}","VisualId":"b917b9f95449267164bb"}]}}],"cancelQueries":[],"modelId":${MODEL_ID}}`;

    try {
      const [respMuni, respDist] = await Promise.all([
        hacerPeticion(bodyMunicipios),
        hacerPeticion(bodyDistritos)
      ]);

      function extraerNombres(respuesta) {
        let nombres = decodificarFilas(respuesta, 1)
          .map(f => (f && f[0] !== undefined && f[0] !== null) ? String(f[0]) : null)
          .filter(Boolean)
          .filter(v => !/^\d+$/.test(v));

        if (nombres.length === 0) {
          const textoCrudo = JSON.stringify(respuesta);
          const regex = /"([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .\-]{2,45})"/g;
          const vistos = new Set();
          let m;
          while ((m = regex.exec(textoCrudo)) !== null) vistos.add(m[1].trim());
          nombres = [...vistos];
        }
        return [...new Set(nombres)].sort((a, b) => a.localeCompare(b, 'es'));
      }

      const listaMunicipios = extraerNombres(respMuni).map(n => ({ nombre: n, tipo: "Municipio" }));
      const listaDistritos = extraerNombres(respDist).map(n => ({ nombre: n, tipo: "Distrito" }));

      diccionarioLugares = [...listaMunicipios, ...listaDistritos];

      if (diccionarioLugares.length > 0) {
        // GUARDAR EN CACHÉ
        localStorage.setItem(CACHE_ZONAS_KEY, JSON.stringify(diccionarioLugares));
        localStorage.setItem(CACHE_ZONAS_TIME, tiempoActual.toString());

        document.getElementById("estadoDiccionario").innerHTML = `<span class="estado-ok">✅ Zonas descargadas y guardadas. Escribe una zona para empezar.</span>`;
        document.getElementById("lugarInput").disabled = false;
        document.getElementById("btnBuscar").disabled = false;
        document.getElementById("lugarInput").focus();
      } else {
        document.getElementById("estadoDiccionario").innerHTML = `<span class="error">❌ No se pudo leer la lista de zonas. Revisa la conexión.</span>`;
      }
    } catch (error) {
      console.error("Error al descargar zonas:", error);
      document.getElementById("estadoDiccionario").innerHTML = `<span class="error">❌ Error de conexión al descargar la lista de zonas.</span>`;
    }
  };

  // ==========================================
  // BÚSQUEDA PRINCIPAL
  // ==========================================
  async function buscarPorLugar() {
    const textoInput = document.getElementById("lugarInput").value.trim();
    const estadoText = document.getElementById("estadoText");
    const resumen = document.getElementById("resumenResultados");
    const grid = document.getElementById("resultadosGrid");
    const btnBuscar = document.getElementById("btnBuscar");

    if (!textoInput) {
      estadoText.innerText = "Escribe el nombre de un municipio o distrito antes de buscar.";
      estadoText.className = "error";
      return;
    }

    const query = normalizarTexto(textoInput);
    
    let lugar = diccionarioLugares.find(l => normalizarTexto(l.nombre) === query);
    if (!lugar) {
      lugar = diccionarioLugares.find(l => normalizarTexto(l.nombre).includes(query));
    }

    if (!lugar) {
      estadoText.innerText = `❌ No se encontró ningún lugar parecido a "${textoInput}".`;
      estadoText.className = "error";
      resumen.innerText = "";
      grid.innerHTML = "";
      return;
    }

    document.getElementById("lugarInput").value = lugar.nombre;

    estadoText.innerHTML = `Buscando Centros Educativos en el <strong>${lugar.tipo} de ${lugar.nombre}</strong>…`;
    estadoText.className = "";
    resumen.innerText = "";
    grid.innerHTML = `<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>`;
    btnBuscar.disabled = true;

    try {
      const body = generarBodyLugar(lugar);
      const respuesta = await hacerPeticion(body);
      
      // ¡AQUÍ ESTÁ EL CAMBIO! Ahora decodificamos 6 columnas (se agregó el Código al inicio)
      const filas = decodificarFilas(respuesta, 6); 

      grid.innerHTML = "";

      if (filas.length === 0) {
        estadoText.innerText = `No se encontraron Centros Educativos para el ${lugar.tipo} "${lugar.nombre}".`;
        estadoText.className = "error";
      } else {
        estadoText.innerText = "";
        resumen.innerText = `${filas.length} Centro(s) Educativo(s) encontrados en ${lugar.nombre} (Ordenados por cercanía en ruta)`;
        
        // ¡Magia aplicada aquí!
        const filasOrdenadas = ordenarPorCercania(filas);
        
        filasOrdenadas.slice(0, MAX_RESULTADOS).forEach(fila => renderTarjeta(fila, grid));
      }
    } catch (error) {
      console.error(error);
      estadoText.innerText = "Hubo un error de conexión con Power BI. Intenta de nuevo.";
      estadoText.className = "error";
      grid.innerHTML = "";
    } finally {
      btnBuscar.disabled = false;
    }
  }

  // Generador dinámico: decide si filtra por la columna 'Municipio' o por 'Distrito'
function generarBodyLugar(lugar) {
    const propiedadAFiltrar = lugar.tipo === "Municipio" ? "Municipio" : "Distrito";
    
    // Se agregó la columna "Código" al bloque Select y al bloque Projections
    return `{"version":"1.0.0","queries":[{"Query":{"Commands":[{"SemanticQueryDataShapeCommand":{"Query":{"Version":2,"From":[{"Name":"c","Entity":"CE_2024","Type":0}],"Select":[{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Código"},"Name":"CE_2024.Codigo"},{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Nombre del Centro Educativo"},"Name":"CE_2024.Nombre"},{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Distrito"},"Name":"CE_2024.Distrito"},{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Dirección"},"Name":"CE_2024.Direccion"},{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"GoogleMapsLink"},"Name":"CE_2024.GMaps"},{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"WazeLink"},"Name":"CE_2024.Waze"}],"Where":[{"Condition":{"In":{"Expressions":[{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"${propiedadAFiltrar}"}}],"Values":[[{"Literal":{"Value":"'${lugar.nombre.replace(/'/g, "''")}'"}}]]}}}],"OrderBy":[{"Direction":1,"Expression":{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Nombre del Centro Educativo"}}}]},"Binding":{"Primary":{"Groupings":[{"Projections":[0,1,2,3,4,5]}]},"DataReduction":{"DataVolume":3,"Primary":{"Top":{"Count":${MAX_RESULTADOS}}}},"Version":1},"ExecutionMetricsKind":1}}]},"ApplicationContext":{"DatasetId":"${DATASET_ID}","Sources":[{"ReportId":"${REPORT_ID}","VisualId":"0118ca5223a73939f738"}]}}],"cancelQueries":[],"modelId":${MODEL_ID}}`;
  }

  // ==========================================
  // DECODIFICACIÓN DE RESPUESTAS DE POWER BI
  // ==========================================
  function decodificarFilas(data, numCols) {
    try {
      const resultData = data.results[0].result.data;
      const dm0 = resultData.dsr.DS[0].PH[0].DM0;
      const valueDicts = resultData.dsr.DS[0].ValueDicts || {};
      const descriptorSelect = (resultData.descriptor && resultData.descriptor.Select) || [];

      const filas = [];
      let anterior = null;

      for (const fila of dm0) {
        let actual;
        if (fila.C) {
          if (fila.R !== undefined && anterior) {
            actual = new Array(numCols);
            let ci = 0;
            for (let i = 0; i < numCols; i++) {
              if (fila.R & (1 << i)) {
                actual[i] = anterior[i];
              } else {
                actual[i] = fila.C[ci++];
              }
            }
          } else {
            actual = fila.C.slice(0, numCols);
            while (actual.length < numCols) {
              actual.push(anterior ? anterior[actual.length] : null);
            }
          }
        } else {
          actual = anterior ? anterior.slice() : new Array(numCols).fill(null);
        }

        for (let i = 0; i < numCols; i++) {
          if (typeof actual[i] !== "number") continue;
          const desc = descriptorSelect[i];
          let dict = null;
          if (desc && desc.DictionaryIndex !== undefined) {
            dict = valueDicts["D" + desc.DictionaryIndex];
          }
          if (!dict) dict = valueDicts["D" + i];
          if (dict && dict[actual[i]] !== undefined) {
            actual[i] = dict[actual[i]];
          }
        }

        filas.push(actual);
        anterior = actual;
      }
      return filas;
    } catch (e) {
      console.error("No se pudo decodificar la respuesta de Power BI:", e);
      return [];
    }
  }

  // --- COORDENADAS ---
  function extraerCoordenadas(url) {
    if (!url || typeof url !== "string") return null;
    const regexWaze = /ll=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const regexMaps = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const regexMapsQ = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;

    const match = url.match(regexWaze) || url.match(regexMaps) || url.match(regexMapsQ);
    if (match) return { lat: match[1], lng: match[2], texto: `${match[1]}, ${match[2]}` };
    return null;
  }

  // --- RENDER DE TARJETAS ---
  // --- RENDER DE TARJETAS ---
  function renderTarjeta(fila, contenedor) {
    const [codigo, nombre, distrito, direccion, googleLink, wazeLink] = fila;

    const linkParaCoords = wazeLink || googleLink;
    const coords = extraerCoordenadas(linkParaCoords);

    const codigoSeguro = escaparHTML(codigo || "Sin código");
    const nombreSeguro = escaparHTML(nombre || "Nombre no disponible");
    const distritoSeguro = escaparHTML(distrito || "—");
    const direccionSegura = escaparHTML(direccion || "Sin dirección registrada");

    const coordsHTML = coords
      ? `<div class="coords">${coords.texto}</div>`
      : `<div class="coords no-disp">Coordenadas no disponibles</div>`;

    let botonesMapa = "";
    if (googleLink && String(googleLink).includes("http")) {
      botonesMapa += `<a href="${escaparAtributo(googleLink)}" target="_blank" rel="noopener" class="btn-link">🗺️ Google Maps</a>`;
    }
    if (wazeLink && String(wazeLink).includes("http")) {
      botonesMapa += `<a href="${escaparAtributo(wazeLink)}" target="_blank" rel="noopener" class="btn-link">🚗 Waze</a>`;
    }
    if (coords) {
      const valorCopiar = coords.texto.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      botonesMapa += `<button class="btn-copiar" onclick="copiarAlPortapapeles('${valorCopiar}')">Copiar coordenadas</button>`;
    }

    const tarjeta = document.createElement("div");
    tarjeta.className = "tarjeta-ce";
    
    // --- CAMBIO APLICADO AQUÍ ---
    // Usamos flexbox para que el código y el nombre no se mezclen.
    // El span del código ahora tiene estilo de botón, cursor de mano y evento onclick para copiar.
    tarjeta.innerHTML = `
      <h3 style="display: flex; align-items: flex-start; gap: 8px;">
        <span 
          onclick="copiarAlPortapapeles('${codigoSeguro}')" 
          title="Haz clic para copiar el código"
          style="background: #EAF0F6; color: var(--azul-inst); padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, Consolas, monospace; font-size: 13.5px; cursor: pointer; user-select: all; border: 1px solid #C9D6E3; flex-shrink: 0;"
        >${codigoSeguro}</span>
        <span style="flex: 1; padding-top: 1px;">${nombreSeguro}</span>
      </h3>
      <div class="meta"><strong>Distrito:</strong> ${distritoSeguro}</div>
      <div class="meta"><strong>Dirección:</strong> ${direccionSegura}</div>
      ${coordsHTML}
      <div class="acciones-btn">${botonesMapa}</div>
    `;
    contenedor.appendChild(tarjeta);
  }

  function escaparHTML(str) {
    const div = document.createElement("div");
    div.innerText = str;
    return div.innerHTML;
  }
  function escaparAtributo(str) {
    return String(str).replace(/"/g, "&quot;");
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

  // --- COPIAR AL PORTAPAPELES ---
  function copiarAlPortapapeles(texto) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto)
        .then(() => mostrarToast(`Copiado: ${texto}`))
        .catch(() => fallbackCopiar(texto));
    } else {
      fallbackCopiar(texto);
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
      mostrarToast(exitoso ? (mensajePersonalizado || `Copiado: ${texto}`) : "❌ Error al copiar");
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
  // AUTOCOMPLETADO INTELIGENTE (MUNICIPIOS Y DISTRITOS)
  // ==========================================
  const MAX_SUGERENCIAS = 40;
  let sugerenciasActuales = [];
  let indiceActivo = -1;

  const inputLugar = document.getElementById("lugarInput");
  const cajaSugerencias = document.getElementById("sugerencias");

  function normalizarTexto(texto) {
    if (!texto) return "";
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function actualizarSugerencias() {
    const texto = inputLugar.value.trim();
    indiceActivo = -1;
    const query = normalizarTexto(texto);

    if (!query || !diccionarioLugares.length) {
      cajaSugerencias.classList.remove("show");
      cajaSugerencias.innerHTML = "";
      sugerenciasActuales = [];
      return;
    }

    const coincidencias = diccionarioLugares.filter(l => normalizarTexto(l.nombre).includes(query));
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
    
    // Renderizamos las sugerencias con una pequeña etiqueta que dice "Municipio" o "Distrito"
    sugerenciasActuales.forEach((lugar, i) => {
      const claseBadge = lugar.tipo === "Municipio" ? "badge-municipio" : "badge-distrito";
      html += `
        <div class="sugerencia-item" data-index="${i}" onclick="seleccionarSugerencia(${i})">
          <span>${escaparHTML(lugar.nombre)}</span>
          <span class="badge-tipo ${claseBadge}">${lugar.tipo}</span>
        </div>`;
    });

    cajaSugerencias.innerHTML = html;
    cajaSugerencias.classList.add("show");
  }

  function seleccionarSugerencia(i) {
    const lugar = sugerenciasActuales[i];
    if (!lugar) return;
    inputLugar.value = lugar.nombre;
    cajaSugerencias.classList.remove("show");
    cajaSugerencias.innerHTML = "";
    sugerenciasActuales = [];
    buscarPorLugar();
  }

  function resaltarActiva() {
    const items = cajaSugerencias.querySelectorAll(".sugerencia-item");
    items.forEach((el, i) => el.classList.toggle("activa", i === indiceActivo));
    if (indiceActivo >= 0 && items[indiceActivo]) {
      items[indiceActivo].scrollIntoView({ block: "nearest" });
    }
  }

  inputLugar.addEventListener("input", actualizarSugerencias);

  inputLugar.addEventListener("keydown", function (e) {
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
        buscarPorLugar();
      }
      return;
    }
    if (e.key === "Escape") {
      cajaSugerencias.classList.remove("show");
    }
  });

  document.addEventListener("click", function (e) {
    if (!cajaSugerencias.contains(e.target) && e.target !== inputLugar) {
      cajaSugerencias.classList.remove("show");
    }
  });

  // ==========================================
  // CÁLCULO DE DISTANCIAS Y ORDENAMIENTO (VECINO MÁS CERCANO)
  // ==========================================
  function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en kilómetros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Devuelve la distancia en km
  }

  function ordenarPorCercania(filas) {
    const filasConCoords = [];
    const filasSinCoords = [];

    // 1. Extraemos las coordenadas antes de pintar las tarjetas
    filas.forEach(fila => {
      const wazeLink = fila[5]; // Según la estructura de tu código
      const googleLink = fila[4];
      const link = wazeLink || googleLink;
      
      const coords = extraerCoordenadas(link);
      if (coords) {
        filasConCoords.push({ 
          filaOriginal: fila, 
          lat: parseFloat(coords.lat), 
          lng: parseFloat(coords.lng) 
        });
      } else {
        filasSinCoords.push(fila); // Si no hay link de mapa, se va al final
      }
    });

    if (filasConCoords.length === 0) return filas;

    const rutaOrdenada = [];
    
    // 2. Tomamos el primer CE como nuestro "Punto de Partida"
    let puntoActual = filasConCoords.shift();
    rutaOrdenada.push(puntoActual.filaOriginal);

    // 3. Buscamos iterativamente el más cercano
    while (filasConCoords.length > 0) {
      let indexMasCercano = 0;
      let distanciaMinima = Infinity;

      for (let i = 0; i < filasConCoords.length; i++) {
        const candidato = filasConCoords[i];
        const dist = calcularDistancia(puntoActual.lat, puntoActual.lng, candidato.lat, candidato.lng);
        
        if (dist < distanciaMinima) {
          distanciaMinima = dist;
          indexMasCercano = i;
        }
      }

      // Movemos el más cercano a nuestra ruta ordenada y lo hacemos nuestro nuevo punto de partida
      puntoActual = filasConCoords.splice(indexMasCercano, 1)[0];
      rutaOrdenada.push(puntoActual.filaOriginal);
    }

    // 4. Juntamos la ruta ordenada con los CEs que no tenían coordenadas
    return rutaOrdenada.concat(filasSinCoords);
  }
