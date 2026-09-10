export class MinedAPI {
  constructor() {
    this.HEADERS_API = {
      "Accept": "application/json, text/plain, */*",
      "X-PowerBI-ResourceKey": "d959e760-42b8-4e9a-8a41-de0d6ca8f8ce",
      "Content-Type": "application/json;charset=UTF-8"
    };
    this.URL_API = "https://wabi-paas-1-scus-api.analysis.windows.net/public/reports/querydata?synchronous=true";
    this.DATASET_ID = "1286915e-8f7f-487f-bae3-73a9e488c456";
    this.REPORT_ID = "243201a2-4a9e-4f70-9997-ed23d079ba3f";
    this.MODEL_ID = 3759890;
    this.MAX_RESULTADOS = 3000;
    this.diccionarioLugares = [];
  }

  async descargarZonas() {
    const CACHE_KEY = "diccionario_zonas_mined";
    const CACHE_TIME_KEY = "diccionario_zonas_time";
    const HORAS_CACHE = 24;
    const limiteTiempo = HORAS_CACHE * 60 * 60 * 1000;
    const tiempoActual = Date.now();

    // 1. Intentar cargar desde caché
    try {
      const cacheGuardada = localStorage.getItem(CACHE_KEY);
      const tiempoGuardado = localStorage.getItem(CACHE_TIME_KEY);

      if (cacheGuardada && tiempoGuardado && (tiempoActual - Number(tiempoGuardado) < limiteTiempo)) {
        const parsed = JSON.parse(cacheGuardada);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.diccionarioLugares = parsed;
          return this.diccionarioLugares;
        }
      }
    } catch (e) {
      console.warn("Storage inaccesible:", e);
    }

    // 2. Si no hay caché válida, consultar a Power BI
    const bodyMunicipios = `{"version":"1.0.0","queries":[{"Query":{"Commands":[{"SemanticQueryDataShapeCommand":{"Query":{"Version":2,"From":[{"Name":"c","Entity":"CE_2024","Type":0}],"Select":[{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Municipio"},"Name":"CE_2024.Municipio"}],"OrderBy":[{"Direction":1,"Expression":{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Municipio"}}}]},"Binding":{"Primary":{"Groupings":[{"Projections":[0]}]},"DataReduction":{"DataVolume":3,"Primary":{"Top":{"Count":30000}}},"Version":1},"ExecutionMetricsKind":1}}]},"ApplicationContext":{"DatasetId":"${this.DATASET_ID}","Sources":[{"ReportId":"${this.REPORT_ID}","VisualId":"17095abaaae058a6f737"}]}}],"cancelQueries":[],"modelId":${this.MODEL_ID}}`;
    const bodyDistritos = `{"version":"1.0.0","queries":[{"Query":{"Commands":[{"SemanticQueryDataShapeCommand":{"Query":{"Version":2,"From":[{"Name":"c","Entity":"CE_2024","Type":0}],"Select":[{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Distrito"},"Name":"CE_2024.Distrito"}],"OrderBy":[{"Direction":1,"Expression":{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Distrito"}}}]},"Binding":{"Primary":{"Groupings":[{"Projections":[0]}]},"DataReduction":{"DataVolume":3,"Primary":{"Top":{"Count":30000}}},"Version":1},"ExecutionMetricsKind":1}}]},"ApplicationContext":{"DatasetId":"${this.DATASET_ID}","Sources":[{"ReportId":"${this.REPORT_ID}","VisualId":"b917b9f95449267164bb"}]}}],"cancelQueries":[],"modelId":${this.MODEL_ID}}`;

    const [respMuni, respDist] = await Promise.all([
      this.hacerPeticion(bodyMunicipios),
      this.hacerPeticion(bodyDistritos)
    ]);

    const extraidosMuni = this.extraerNombres(respMuni).map(n => ({ nombre: n, tipo: "Municipio" }));
    const extraidosDist = this.extraerNombres(respDist).map(n => ({ nombre: n, tipo: "Distrito" }));

    this.diccionarioLugares = [...extraidosMuni, ...extraidosDist];

    try {
      if (this.diccionarioLugares.length > 0) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(this.diccionarioLugares));
        localStorage.setItem(CACHE_TIME_KEY, tiempoActual.toString());
      }
    } catch (e) {
      console.warn("No se pudo guardar la caché:", e);
    }

    return this.diccionarioLugares;
  }

  extraerNombres(respuesta) {
    let nombres = this.decodificarFilas(respuesta, 1)
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

  async buscarCentros(lugar) {
    const propiedadAFiltrar = lugar.tipo === "Municipio" ? "Municipio" : "Distrito";
    const body = `{"version":"1.0.0","queries":[{"Query":{"Commands":[{"SemanticQueryDataShapeCommand":{"Query":{"Version":2,"From":[{"Name":"c","Entity":"CE_2024","Type":0}],"Select":[{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Código"},"Name":"CE_2024.Codigo"},{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Nombre del Centro Educativo"},"Name":"CE_2024.Nombre"},{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Distrito"},"Name":"CE_2024.Distrito"},{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Dirección"},"Name":"CE_2024.Direccion"},{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"GoogleMapsLink"},"Name":"CE_2024.GMaps"},{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"WazeLink"},"Name":"CE_2024.Waze"}],"Where":[{"Condition":{"In":{"Expressions":[{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"${propiedadAFiltrar}"}}],"Values":[[{"Literal":{"Value":"'${lugar.nombre.replace(/'/g, "''")}'"}}]]}}}],"OrderBy":[{"Direction":1,"Expression":{"Column":{"Expression":{"SourceRef":{"Source":"c"}},"Property":"Nombre del Centro Educativo"}}}]},"Binding":{"Primary":{"Groupings":[{"Projections":[0,1,2,3,4,5]}]},"DataReduction":{"DataVolume":3,"Primary":{"Top":{"Count":${this.MAX_RESULTADOS}}}},"Version":1},"ExecutionMetricsKind":1}}]},"ApplicationContext":{"DatasetId":"${this.DATASET_ID}","Sources":[{"ReportId":"${this.REPORT_ID}","VisualId":"0118ca5223a73939f738"}]}}],"cancelQueries":[],"modelId":${this.MODEL_ID}}`;

    const respuesta = await this.hacerPeticion(body);
    return this.decodificarFilas(respuesta, 6);
  }

  async hacerPeticion(bodyString) {
    const response = await fetch(this.URL_API, {
      headers: this.HEADERS_API,
      body: bodyString,
      method: "POST",
      mode: "cors",
      credentials: "omit"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }

  decodificarFilas(data, numCols) {
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

  normalizarTexto(texto) {
    if (!texto) return "";
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
}