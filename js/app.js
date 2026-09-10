import { FirebaseManager } from './db/FirebaseManager.js';
import { MinedAPI } from './api/MinedAPI.js';
import { MapaUI } from './ui/MapaUI.js';

const db = new FirebaseManager();
const api = new MinedAPI();
let mapa;

// Elementos DOM
const inputLugar = document.getElementById("lugarInput");
const btnBuscar = document.getElementById("btnBuscar");
const cajaSugerencias = document.getElementById("sugerenciasCaja");
const estadoText = document.getElementById("estadoDiccionario");

// Variables para autocompletado
let sugerenciasActuales = [];
let indiceActivo = -1;

// ==========================================
// 1. INICIALIZACIÓN ROBUSTA
// ==========================================
async function iniciarApp() {
  try {
    mapa = new MapaUI('mapa-mined');
    
    estadoText.innerHTML = `⏳ Descargando listado de lugares actualizados...`;

    // Cargar en paralelo manejando posibles errores
    await Promise.all([
      db.cargarEstadosIniciales().catch(err => {
        console.warn("Advertencia Firebase:", err);
        return {};
      }),
      api.descargarZonas().catch(err => {
        console.error("Error Power BI:", err);
        throw new Error("No se pudo descargar el listado de municipios.");
      })
    ]);

    estadoText.innerHTML = `<span class="estado-ok">✅ Zonas listas. Escribe un municipio o distrito.</span>`;
    
    // Habilitar controles de la interfaz
    inputLugar.disabled = false;
    btnBuscar.disabled = false;
    inputLugar.focus();

    // Asignación explícita de eventos
    btnBuscar.addEventListener("click", buscarLugarYRenderizar);
    inputLugar.addEventListener("input", actualizarSugerencias);
    inputLugar.addEventListener("keydown", manejarTecladoSugerencias);

  } catch (error) {
    console.error("Error en iniciarApp:", error);
    estadoText.innerHTML = `<span class="error">❌ ${error.message}</span>`;
  }
}

// Ejecutar automáticamente al cargar el documento (Compatible con type="module")
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciarApp);
} else {
  iniciarApp();
}

// ==========================================
// 2. LÓGICA PRINCIPAL: BUSCAR Y RENDERIZAR
// ==========================================
async function buscarLugarYRenderizar() {
  const query = api.normalizarTexto(inputLugar.value.trim());
  if (!query) return estadoText.innerHTML = `<span class="error">Escribe un lugar antes de buscar.</span>`;

  const lugar = api.diccionarioLugares.find(l => api.normalizarTexto(l.nombre) === query) || 
                api.diccionarioLugares.find(l => api.normalizarTexto(l.nombre).includes(query));

  if (!lugar) {
    estadoText.innerHTML = `<span class="error">❌ Lugar no encontrado. Escribe el nombre completo o selecciónalo de la lista.</span>`;
    return mapa.limpiarMapaYLista();
  }

  inputLugar.value = lugar.nombre;
  cajaSugerencias.classList.remove("show");
  estadoText.innerHTML = `Buscando centros y coordenadas en: <strong>${lugar.nombre}</strong>...`;
  btnBuscar.disabled = true;

  try {
    const filas = await api.buscarCentros(lugar);
    const total = mapa.dibujarPines(filas, db);
    
    if (total > 0) {
      estadoText.innerHTML = `<span class="estado-ok">✅ Se ubicaron ${total} centros en ${lugar.nombre}.</span>`;
    } else {
      estadoText.innerHTML = `<span class="error">Se encontraron escuelas en ${lugar.nombre}, pero no tienen coordenadas válidas para mostrar en el mapa.</span>`;
    }
  } catch (error) {
    console.error("Error al buscar centros:", error);
    estadoText.innerHTML = `<span class="error">❌ Error al consultar la base de datos de Power BI: ${error.message}</span>`;
  } finally {
    btnBuscar.disabled = false;
  }
}

// ==========================================
// 3. FUNCIONES GLOBALES (Expuestas a la ventana)
// ==========================================
window.seleccionarCentro = (codigo, moverCamara) => {
  mapa.seleccionar(codigo, db, moverCamara);
};

window.llevarAlBuscador = (codigo) => {
  if (!codigo || codigo === "N/A") return;
  window.open(`index.html?ce=${encodeURIComponent(codigo)}`, '_blank');
};

window.guardarEstadoBD = async (codigo) => {
  const selectElem = document.getElementById(`select_estado_${codigo}`);
  if (!selectElem) return;
  
  const nuevoEstado = selectElem.value;
  try {
    const info = await db.guardarEstado(codigo, nuevoEstado);
    alert("¡Estado guardado correctamente!");
    
    const labelElem = document.getElementById(`label_estado_${codigo}`);
    if (labelElem) labelElem.innerText = `${info.estado} el ${info.fecha}`;
    
    const marcadorInfo = mapa.diccionarioMarcadores[codigo];
    if (marcadorInfo) marcadorInfo.marcador.setIcon(mapa.crearIcono(true, info.estado));
  } catch (error) {
    alert(error.message);
  }
};

window.seleccionarSugerencia = (i) => {
  if (!sugerenciasActuales[i]) return;
  inputLugar.value = sugerenciasActuales[i].nombre;
  cajaSugerencias.classList.remove("show");
  buscarLugarYRenderizar();
};

// ==========================================
// 4. AUTOCOMPLETADO Y SUGERENCIAS
// ==========================================
function actualizarSugerencias() {
  const query = api.normalizarTexto(inputLugar.value.trim());
  indiceActivo = -1;

  if (!query) {
    cajaSugerencias.classList.remove("show");
    return sugerenciasActuales = [];
  }

  sugerenciasActuales = api.diccionarioLugares.filter(l => api.normalizarTexto(l.nombre).includes(query)).slice(0, 40);

  if (!sugerenciasActuales.length) {
    cajaSugerencias.innerHTML = `<div class="sugerencia-item" style="color: #888;">Sin coincidencias</div>`;
    return cajaSugerencias.classList.add("show");
  }

  cajaSugerencias.innerHTML = sugerenciasActuales.map((lugar, i) => `
    <div class="sugerencia-item" onclick="window.seleccionarSugerencia(${i})">
      <span>${mapa.escaparHTML(lugar.nombre)}</span>
      <span class="badge-tipo ${lugar.tipo === 'Municipio' ? 'badge-municipio' : 'badge-distrito'}">${lugar.tipo}</span>
    </div>`
  ).join('');
  
  cajaSugerencias.classList.add("show");
}

function manejarTecladoSugerencias(e) {
  const items = cajaSugerencias.querySelectorAll(".sugerencia-item");
  if (!cajaSugerencias.classList.contains("show") || !items.length) return;

  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    indiceActivo = e.key === "ArrowDown" ? Math.min(indiceActivo + 1, items.length - 1) : Math.max(indiceActivo - 1, 0);
    items.forEach((el, i) => el.classList.toggle("activa", i === indiceActivo));
    if (items[indiceActivo]) items[indiceActivo].scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (indiceActivo >= 0) window.seleccionarSugerencia(indiceActivo);
    else { cajaSugerencias.classList.remove("show"); buscarLugarYRenderizar(); }
  } else if (e.key === "Escape") {
    cajaSugerencias.classList.remove("show");
  }
}

document.addEventListener("click", (e) => {
  if (cajaSugerencias && !cajaSugerencias.contains(e.target) && e.target !== inputLugar) {
    cajaSugerencias.classList.remove("show");
  }
});