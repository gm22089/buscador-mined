// ==========================================
  // INICIALIZACIÓN DEL MAPA (LEAFLET)
  // ==========================================
  const mapa = L.map('mapa-mined').setView([13.794185, -88.89653], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap'
  }).addTo(mapa);

  const capaPines = L.featureGroup().addTo(mapa);

  // Almacén de marcadores para interactuar con la lista
  let diccionarioMarcadores = {}; 
  let codigoSeleccionadoActual = null;


  // ==========================================
  // ICONOS PERSONALIZADOS (NORMAL VS SELECCIONADO)
  // ==========================================
  function crearIconoPin(esSeleccionado = false) {
    const color = esSeleccionado ? "#B8892B" : "#14375E"; // Dorado si está seleccionado, Azul MINED si es normal
    const tamano = esSeleccionado ? [36, 48] : [28, 38];
    const ancla = esSeleccionado ? [18, 48] : [14, 38];

    const svgIcono = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="${tamano[0]}" height="${tamano[1]}">
        <path fill="${color}" stroke="#FFFFFF" stroke-width="1.5" d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12zm0 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
      </svg>`;

    return L.divIcon({
      className: esSeleccionado ? 'pin-custom pin-activo' : 'pin-custom',
      html: svgIcono,
      iconSize: tamano,
      iconAnchor: ancla,
      popupAnchor: [0, -ancla[1] + 5]
    });
  }


  // ==========================================
  // CONFIGURACIÓN API Y VARIABLES GLOBALES
  // ==========================================
  let diccionarioLugares = [];

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
  // ==========================================
  window.onload = async function () {
    const CACHE_ZONAS_KEY = "diccionario_zonas_mined";
    const CACHE_ZONAS_TIME = "diccionario_zonas_time";
    const HORAS_CACHE = 24;
    const limiteTiempo = HORAS_CACHE * 60 * 60 * 1000;
    const tiempoActual = Date.now();

    const cacheGuardada = localStorage.getItem(CACHE_ZONAS_KEY);
    const tiempoGuardado = localStorage.getItem(CACHE_ZONAS_TIME);

    if (cacheGuardada && tiempoGuardado && (tiempoActual - tiempoGuardado < limiteTiempo)) {
        diccionarioLugares = JSON.parse(cacheGuardada);
        document.getElementById("estadoDiccionario").innerHTML = `<span class="estado-ok">⚡ Zonas cargadas. Escribe un municipio o distrito.</span>`;
        habilitarBuscador();
        return;
    }

    document.getElementById("estadoDiccionario").innerHTML = `⏳ Descargando listado de lugares actualizados...`;
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
        localStorage.setItem(CACHE_ZONAS_KEY, JSON.stringify(diccionarioLugares));
        localStorage.setItem(CACHE_ZONAS_TIME, tiempoActual.toString());

        document.getElementById("estadoDiccionario").innerHTML = `<span class="estado-ok">✅ Zonas listas. Escribe un municipio o distrito.</span>`;
        habilitarBuscador();
      } else {
        document.getElementById("estadoDiccionario").innerHTML = `<span class="error">❌ No se pudo leer la lista de zonas.</span>`;
      }
    } catch (error) {
      document.getElementById("estadoDiccionario").innerHTML = `<span class="error">❌ Error de conexión al descargar zonas.</span>`;
    }
  };

  function habilitarBuscador() {
    document.getElementById("lugarInput").disabled = false;
    document.getElementById("btnBuscar").disabled = false;
    document.getElementById("lugarInput").focus();
    document.getElementById("btnBuscar").addEventListener("click", buscarPorLugar);
  }


  // ==========================================
  // BÚSQUEDA Y CONSULTA DE DATOS
  // ==========================================
  async function buscarPorLugar() {
    const textoInput = document.getElementById("lugarInput").value.trim();
    const estadoText = document.getElementById("estadoDiccionario");
    const btnBuscar = document.getElementById("btnBuscar");

    if (!textoInput) {
      estadoText.innerHTML = `<span class="error">Escribe el nombre de un lugar antes de buscar.</span>`;
      return;
    }

    const query = normalizarTexto(textoInput);
    let lugar = diccionarioLugares.find(l => normalizarTexto(l.nombre) === query) || diccionarioLugares.find(l => normalizarTexto(l.nombre).includes(query));

    if (!lugar) {
      estadoText.innerHTML = `<span class="error">❌ Lugar no encontrado.</span>`;
      limpiarMapaYLista();
      return;
    }

    document.getElementById("lugarInput").value = lugar.nombre;
    estadoText.innerHTML = `Buscando centros y coordenadas en: <strong>${lugar.nombre}</strong>...`;
    btnBuscar.disabled = true;

    try {
      const body = generarBodyLugar(lugar);
      const respuesta = await hacerPeticion(body);
      const filas = decodificarFilas(respuesta, 6); 
      
      mapearResultados(filas, lugar);

    } catch (error) {
      estadoText.innerHTML = `<span class="error">Hubo un error al extraer los datos de Power BI.</span>`;
    } finally {
      btnBuscar.disabled = false;
    }
  }

  function generarBodyLugar(lugar) {
    const propiedadAFiltrar = lugar.tipo === "Municipio" ? "Municipio" : "Distrito";
    return `{"version":"1.0.0","queries":[{"Query":{"Commands":[{"SemanticQueryDataShapeCommand":{"Query":{"Version":2,"From":[{"Name":"c","Entity":"CE_2024","Type":0}],"Select":[{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Código"},"Name":"CE_2024.Codigo"},{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Nombre del Centro Educativo"},"Name":"CE_2024.Nombre"},{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Distrito"},"Name":"CE_2024.Distrito"},{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Dirección"},"Name":"CE_2024.Direccion"},{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"GoogleMapsLink"},"Name":"CE_2024.GMaps"},{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"WazeLink"},"Name":"CE_2024.Waze"}],"Where":[{"Condition":{"In":{"Expressions":[{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"${propiedadAFiltrar}"}}],"Values":[[{"Literal":{"Value":"'${lugar.nombre.replace(/'/g, "''")}'"}}]]}}}],"OrderBy":[{"Direction":1,"Expression":{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Nombre del Centro Educativo"}}}]},"Binding":{"Primary":{"Groupings":[{"Projections":[0,1,2,3,4,5]}]},"DataReduction":{"DataVolume":3,"Primary":{"Top":{"Count":${MAX_RESULTADOS}}}},"Version":1},"ExecutionMetricsKind":1}}]},"ApplicationContext":{"DatasetId":"${DATASET_ID}","Sources":[{"ReportId":"${REPORT_ID}","VisualId":"0118ca5223a73939f738"}]}}],"cancelQueries":[],"modelId":${MODEL_ID}}`;
  }


  // ==========================================
  // DIBUJAR PUNTOS Y MOSTRAR LISTA
  // ==========================================
  function mapearResultados(filas, lugarInfo) {
    limpiarMapaYLista();

    const contLista = document.getElementById("contenedorListaMapeados");
    const listaHTML = document.getElementById("listaCentrosMapeados");
    const totalElem = document.getElementById("totalMapeados");

    let puntosEncontrados = 0;
    let htmlItems = "";

    filas.forEach(fila => {
      const [codigo, nombre, distrito, direccion, googleLink, wazeLink] = fila;
      const linkParaCoords = wazeLink || googleLink;
      const coords = extraerCoordenadas(linkParaCoords);

      if (coords && codigo) {
        puntosEncontrados++;

        // 1. Crear marcador con el icono azul (normal)
        const marcador = L.marker([parseFloat(coords.lat), parseFloat(coords.lng)], {
          icon: crearIconoPin(false)
        });
        
        // Popup informativo
        const popupContenido = `
          <div class="popup-mined" style="min-width: 220px;">
            <h4 style="margin: 0 0 5px 0; color: #14375E;">INFRA: ${escaparHTML(String(codigo))}</h4>
            <p style="margin: 0 0 5px 0; font-weight: bold; font-size: 13px; color: #333;">${escaparHTML(nombre || "Sin nombre")}</p>
            <p style="margin: 0 0 5px 0; font-size: 11px; color: #666;"><strong>Distrito:</strong> ${escaparHTML(distrito || "")}</p>
            <p style="margin: 0 0 12px 0; font-size: 11px; color: #666;"><strong>Dirección:</strong> ${escaparHTML(direccion || "Sin dirección")}</p>
            
            <button onclick="llevarAlBuscador('${escaparHTML(String(codigo))}')" style="display:block; width: 100%; text-align:center; padding: 6px; background: #B8892B; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Ver Expediente</button>
          </div>
        `;
        
        marcador.bindPopup(popupContenido);

        // Al hacer clic en el punto en el mapa, resaltar su tarjeta en la lista
        marcador.on('click', () => {
          seleccionarCentro(codigo, false); // false = no mover la cámara agresivamente
        });

        capaPines.addLayer(marcador);

        // Guardar referencia en nuestro diccionario
        diccionarioMarcadores[codigo] = {
          marcador: marcador,
          datos: { codigo, nombre, distrito, direccion }
        };

        // 2. Construir la tarjeta HTML para la lista
        htmlItems += `
          <div class="item-centro-card" id="card-ce-${codigo}" onclick="seleccionarCentro('${codigo}', true)">
            <div class="card-head">
              <span class="badge-infra">${escaparHTML(String(codigo))}</span>
              <button class="btn-ver-expediente" onclick="event.stopPropagation(); llevarAlBuscador('${escaparHTML(String(codigo))}')">Expediente ↗</button>
            </div>
            <div class="card-body">
              <strong>${escaparHTML(nombre || "Sin nombre")}</strong>
              <small>${escaparHTML(distrito || "")}</small>
            </div>
          </div>
        `;
      }
    });

    const estadoText = document.getElementById("estadoDiccionario");
    
    if (puntosEncontrados > 0) {
      estadoText.innerHTML = `<span class="estado-ok">✅ Se ubicaron ${puntosEncontrados} centros educativos en ${lugarInfo.nombre}.</span>`;
      
      // Renderizar listado
      if (listaHTML && contLista) {
        listaHTML.innerHTML = htmlItems;
        if (totalElem) totalElem.innerText = puntosEncontrados;
        contLista.style.display = "block";
      }

      // Ajustar la cámara para ver todos los marcadores
      mapa.fitBounds(capaPines.getBounds(), { padding: [30, 30] });
    } else {
      estadoText.innerHTML = `<span class="error">Se encontraron registros, pero ninguno tenía coordenadas válidas.</span>`;
    }
  }


  // ==========================================
  // LÓGICA DE SELECCIÓN (LISTA <-> MAPA)
  // ==========================================
  function seleccionarCentro(codigo, moverCamara = true) {
    if (!diccionarioMarcadores[codigo]) return;

    // 1. Restaurar el pin anterior a su color normal (Azul)
    if (codigoSeleccionadoActual && diccionarioMarcadores[codigoSeleccionadoActual]) {
      const prevObj = diccionarioMarcadores[codigoSeleccionadoActual];
      prevObj.marcador.setIcon(crearIconoPin(false));
      prevObj.marcador.setZIndexOffset(0);

      const prevCard = document.getElementById(`card-ce-${codigoSeleccionadoActual}`);
      if (prevCard) prevCard.classList.remove("activa");
    }

    // 2. Resaltar el nuevo pin seleccionado (Dorado)
    codigoSeleccionadoActual = codigo;
    const itemActual = diccionarioMarcadores[codigo];
    
    itemActual.marcador.setIcon(crearIconoPin(true));
    itemActual.marcador.setZIndexOffset(1000); // Poner por encima de otros pines

    // Highlight tarjeta en la lista
    const cardActual = document.getElementById(`card-ce-${codigo}`);
    if (cardActual) {
      cardActual.classList.add("activa");
      cardActual.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // 3. Abrir Popup y enfocar mapa si vino desde un clic de la lista
    if (moverCamara) {
      mapa.setView(itemActual.marcador.getLatLng(), 16, { animate: true });
      itemActual.marcador.openPopup();
    }
  }

  function limpiarMapaYLista() {
    capaPines.clearLayers();
    diccionarioMarcadores = {};
    codigoSeleccionadoActual = null;

    const contLista = document.getElementById("contenedorListaMapeados");
    const listaHTML = document.getElementById("listaCentrosMapeados");
    
    if (listaHTML) listaHTML.innerHTML = "";
    if (contLista) contLista.style.display = "none";
  }


  // ==========================================
  // REDIRECCIÓN EN NUEVA PESTAÑA
  // ==========================================
  function llevarAlBuscador(codigo) {
    if(!codigo || codigo === "N/A") return;
    const url = `index.html?ce=${encodeURIComponent(codigo)}`;
    window.open(url, '_blank');
  }


  // ==========================================
  // FUNCIONES DE APOYO Y DECODIFICACIÓN
  // ==========================================
  async function hacerPeticion(bodyString) {
    const response = await fetch(URL_API, { headers: HEADERS_API, body: bodyString, method: "POST", mode: "cors", credentials: "omit" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }

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
              if (fila.R & (1 << i)) actual[i] = anterior[i];
              else actual[i] = fila.C[ci++];
            }
          } else {
            actual = fila.C.slice(0, numCols);
            while (actual.length < numCols) actual.push(anterior ? anterior[actual.length] : null);
          }
        } else {
          actual = anterior ? anterior.slice() : new Array(numCols).fill(null);
        }

        for (let i = 0; i < numCols; i++) {
          if (typeof actual[i] !== "number") continue;
          const desc = descriptorSelect[i];
          let dict = null;
          if (desc && desc.DictionaryIndex !== undefined) dict = valueDicts["D" + desc.DictionaryIndex];
          if (!dict) dict = valueDicts["D" + i];
          if (dict && dict[actual[i]] !== undefined) actual[i] = dict[actual[i]];
        }
        filas.push(actual);
        anterior = actual;
      }
      return filas;
    } catch (e) {
      return [];
    }
  }

  function extraerCoordenadas(url) {
    if (!url || typeof url !== "string") return null;
    const regexWaze = /ll=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const regexMaps = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const regexMapsQ = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match = url.match(regexWaze) || url.match(regexMaps) || url.match(regexMapsQ);
    if (match) return { lat: match[1], lng: match[2] };
    return null;
  }

  function normalizarTexto(texto) {
    if (!texto) return "";
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function escaparHTML(str) {
    const div = document.createElement("div");
    div.innerText = str;
    return div.innerHTML;
  }


  // ==========================================
  // AUTOCOMPLETADO INTELIGENTE
  // ==========================================
  const MAX_SUGERENCIAS = 40;
  let sugerenciasActuales = [];
  let indiceActivo = -1;

  const inputLugar = document.getElementById("lugarInput");
  const cajaSugerencias = document.getElementById("sugerenciasCaja");

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
      html += `<div class="sug-info">Mostrando ${MAX_SUGERENCIAS} de ${coincidencias.length} — sigue escribiendo</div>`;
    }
    
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

  if (inputLugar) {
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
        if (listaVisible && indiceActivo >= 0) seleccionarSugerencia(indiceActivo);
        else {
          cajaSugerencias.classList.remove("show");
          buscarPorLugar();
        }
        return;
      }
      if (e.key === "Escape") cajaSugerencias.classList.remove("show");
    });
  }

  document.addEventListener("click", function (e) {
    if (cajaSugerencias && !cajaSugerencias.contains(e.target) && e.target !== inputLugar) {
      cajaSugerencias.classList.remove("show");
    }
  });