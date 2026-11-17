import { FirebaseManager } from './db/FirebaseManager.js';
import { MinedAPI } from './api/MinedAPI.js';

const db = new FirebaseManager();
const api = new MinedAPI();

let catalogoNacional = [];
let mapaPorCodigo = {};
let registrosBD = [];
let registrosFiltrados = [];

// Referencias DOM
const estadoBanner = document.getElementById("estadoDiccionario");
const inputInicio = document.getElementById("fechaInicio");
const inputFin = document.getElementById("fechaFin");
const selUsuario = document.getElementById("filtroUsuario");
const selDepto = document.getElementById("filtroDepto");
const selMuni = document.getElementById("filtroMuni");

async function iniciarEstadisticas() {
  try {
    const [estadosDict, catalogo] = await Promise.all([
      db.cargarEstadosIniciales(),
      api.obtenerCatalogoCompleto()
    ]);

    catalogoNacional = catalogo;
    catalogo.forEach(ce => {
      mapaPorCodigo[ce.codigo] = ce;
    });

    // Unir datos de Firebase (estado, fecha, usuario) con datos de Power BI (nombre, depto, muni)
    registrosBD = Object.entries(estadosDict).map(([codigo, info]) => {
      const ce = mapaPorCodigo[codigo] || {
        nombre: "Centro Educativo no encontrado en catálogo",
        departamento: "Sin Departamento",
        municipio: "Sin Municipio",
        distrito: "Sin Distrito"
      };

      return {
        codigo,
        nombre: ce.nombre,
        departamento: ce.departamento,
        municipio: ce.municipio,
        distrito: ce.distrito,
        estado: info.estado || "normal",
        fecha: info.fecha || "",
        usuario: (info.usuario || "Sin usuario").trim()
      };
    });

    poblarFiltros();
    aplicarFiltros();

    estadoBanner.innerHTML = `<span class="estado-ok">✅ Datos sincronizados (${catalogoNacional.length} centros en catálogo nacional).</span>`;
  } catch (error) {
    console.error("Error al iniciar estadísticas:", error);
    estadoBanner.innerHTML = `<span class="error">❌ Error al cargar estadísticas: ${error.message}</span>`;
  }
}

function poblarFiltros() {
  // 1. Usuarios únicos (ignorando diferencias de mayúsculas/minúsculas al agrupar)
  const usuariosUnicos = [...new Set(registrosBD.map(r => r.usuario))].sort((a, b) => a.localeCompare(b, 'es'));
  usuariosUnicos.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u;
    opt.textContent = u;
    selUsuario.appendChild(opt);
  });

  // 2. Departamentos únicos
  const deptosUnicos = [...new Set(catalogoNacional.map(c => c.departamento))].sort((a, b) => a.localeCompare(b, 'es'));
  deptosUnicos.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    selDepto.appendChild(opt);
  });

  actualizarSelectorMunicipios();
}

function actualizarSelectorMunicipios() {
  const deptoSeleccionado = selDepto.value;
  selMuni.innerHTML = `<option value="TODOS">Todos los municipios</option>`;

  const base = deptoSeleccionado === "TODOS"
    ? catalogoNacional
    : catalogoNacional.filter(c => c.departamento === deptoSeleccionado);

  const munisUnicos = [...new Set(base.map(c => c.municipio))].sort((a, b) => a.localeCompare(b, 'es'));
  munisUnicos.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    selMuni.appendChild(opt);
  });
}

function aplicarFiltros() {
  const fInicio = inputInicio.value; // Formato YYYY-MM-DD
  const fFin = inputFin.value;       // Formato YYYY-MM-DD
  const uSel = selUsuario.value;
  const dSel = selDepto.value;
  const mSel = selMuni.value;

  // Filtrar los registros guardados en Firebase
  registrosFiltrados = registrosBD.filter(r => {
    if (r.estado === "normal") return false;
    if (fInicio && (!r.fecha || r.fecha < fInicio)) return false;
    if (fFin && (!r.fecha || r.fecha > fFin)) return false;
    if (uSel !== "TODOS" && r.usuario !== uSel) return false;
    if (dSel !== "TODOS" && r.departamento !== dSel) return false;
    if (mSel !== "TODOS" && r.municipio !== mSel) return false;
    return true;
  });

  // Filtrar el catálogo base para que los porcentajes correspondan al departamento/municipio elegido
  const catalogoFiltrado = catalogoNacional.filter(c => {
    if (dSel !== "TODOS" && c.departamento !== dSel) return false;
    if (mSel !== "TODOS" && c.municipio !== mSel) return false;
    return true;
  });

  renderKPIs(catalogoFiltrado, registrosFiltrados);
  renderTablaUsuarios(registrosFiltrados);
  renderTablaDepartamentos(catalogoFiltrado, registrosFiltrados);
  renderTablaMunicipios(catalogoFiltrado, registrosFiltrados);
  renderTablaDetalle(registrosFiltrados);
}

function renderKPIs(catalogoBase, filtrados) {
  const totalCE = catalogoBase.length;
  const visitados = filtrados.filter(r => r.estado === "visitado").length;
  const intervenidos = filtrados.filter(r => r.estado === "intervenido").length;
  const cerrados = filtrados.filter(r => r.estado === "cerrado").length;
  const porcentaje = totalCE > 0 ? ((visitados / totalCE) * 100).toFixed(2) : "0.00";

  document.getElementById("kpiTotal").textContent = totalCE.toLocaleString();
  document.getElementById("kpiVisitados").textContent = visitados.toLocaleString();
  document.getElementById("kpiOtros").textContent = (intervenidos + cerrados).toLocaleString();
  document.getElementById("kpiOtrosDetalle").textContent = `${intervenidos} intervenidos · ${cerrados} cerrados`;
  document.getElementById("kpiPorcentaje").textContent = `${porcentaje}%`;
}

function renderTablaUsuarios(filtrados) {
  const tbody = document.getElementById("tbodyUsuarios");
  const mapaUsuarios = {};

  filtrados.forEach(r => {
    if (!mapaUsuarios[r.usuario]) {
      mapaUsuarios[r.usuario] = { nombre: r.usuario, visitado: 0, intervenido: 0, cerrado: 0, total: 0 };
    }
    if (mapaUsuarios[r.usuario][r.estado] !== undefined) {
      mapaUsuarios[r.usuario][r.estado]++;
    }
    mapaUsuarios[r.usuario].total++;
  });

  const lista = Object.values(mapaUsuarios).sort((a, b) => b.visitado - a.visitado);

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b;">Sin registros en el rango seleccionado</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(u => `
    <tr>
      <td><strong>${escaparHTML(u.nombre)}</strong></td>
      <td><span class="pill-estado pill-visitado">${u.visitado}</span></td>
      <td><span class="pill-estado pill-intervenido">${u.intervenido}</span></td>
      <td><span class="pill-estado pill-cerrado">${u.cerrado}</span></td>
      <td><strong>${u.total}</strong></td>
    </tr>
  `).join("");
}

function renderTablaDepartamentos(catalogoBase, filtrados) {
  const tbody = document.getElementById("tbodyDeptos");
  const stats = {};

  catalogoBase.forEach(c => {
    if (!stats[c.departamento]) stats[c.departamento] = { nombre: c.departamento, total: 0, visitados: 0 };
    stats[c.departamento].total++;
  });

  filtrados.forEach(r => {
    if (r.estado === "visitado" && stats[r.departamento]) {
      stats[r.departamento].visitados++;
    }
  });

  const lista = Object.values(stats).sort((a, b) => (b.visitados / b.total) - (a.visitados / a.total));

  tbody.innerHTML = lista.map(d => {
    const pct = d.total > 0 ? ((d.visitados / d.total) * 100).toFixed(1) : 0;
    return `
      <tr>
        <td><strong>${escaparHTML(d.nombre)}</strong></td>
        <td>${d.visitados} / ${d.total}</td>
        <td>
          <strong>${pct}%</strong>
          <div class="barra-progreso"><div class="barra-progreso-fill" style="width:${Math.min(pct, 100)}%"></div></div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderTablaMunicipios(catalogoBase, filtrados) {
  const tbody = document.getElementById("tbodyMunicipios");
  const stats = {};

  catalogoBase.forEach(c => {
    const key = `${c.departamento}|${c.municipio}`;
    if (!stats[key]) stats[key] = { municipio: c.municipio, depto: c.departamento, total: 0, visitados: 0 };
    stats[key].total++;
  });

  filtrados.forEach(r => {
    const key = `${r.departamento}|${r.municipio}`;
    if (r.estado === "visitado" && stats[key]) {
      stats[key].visitados++;
    }
  });

  const lista = Object.values(stats).sort((a, b) => (b.visitados / b.total) - (a.visitados / a.total));

  tbody.innerHTML = lista.map(m => {
    const pct = m.total > 0 ? ((m.visitados / m.total) * 100).toFixed(1) : 0;
    return `
      <tr>
        <td><strong>${escaparHTML(m.municipio)}</strong> <span style="font-size:11px; color:#64748b;">(${escaparHTML(m.depto)})</span></td>
        <td>${m.visitados} / ${m.total}</td>
        <td>
          <strong>${pct}%</strong>
          <div class="barra-progreso"><div class="barra-progreso-fill" style="width:${Math.min(pct, 100)}%"></div></div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderTablaDetalle(filtrados) {
  const tbody = document.getElementById("tbodyDetalle");
  document.getElementById("totalDetalle").textContent = filtrados.length;

  if (!filtrados.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#64748b;">No hay centros educativos para los filtros seleccionados.</td></tr>`;
    return;
  }

  const ordenados = [...filtrados].sort((a, b) => b.fecha.localeCompare(a.fecha));

  tbody.innerHTML = ordenados.map(r => `
    <tr>
      <td><a href="index.html?ce=${encodeURIComponent(r.codigo)}" target="_blank" style="font-weight:700; color:#1b365d;">${escaparHTML(r.codigo)}</a></td>
      <td>${escaparHTML(r.nombre)}</td>
      <td>${escaparHTML(r.departamento)}</td>
      <td>${escaparHTML(r.municipio)}</td>
      <td><span class="pill-estado pill-${r.estado}">${r.estado.toUpperCase()}</span></td>
      <td>${escaparHTML(r.fecha)}</td>
      <td><strong>${escaparHTML(r.usuario)}</strong></td>
    </tr>
  `).join("");
}

function exportarCSV() {
  if (!registrosFiltrados.length) return alert("No hay datos filtrados para exportar.");

  const headers = ["INFRA", "Centro Educativo", "Departamento", "Municipio", "Distrito", "Estado", "Fecha", "Usuario"];
  const filas = registrosFiltrados.map(r => [
    r.codigo,
    `"${r.nombre.replace(/"/g, '""')}"`,
    `"${r.departamento}"`,
    `"${r.municipio}"`,
    `"${r.distrito}"`,
    r.estado,
    r.fecha,
    `"${r.usuario}"`
  ].join(","));

  const csv = "\uFEFF" + [headers.join(","), ...filas].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `estadisticas_mined_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function escaparHTML(str) {
  const div = document.createElement("div");
  div.innerText = str || "";
  return div.innerHTML;
}

// Eventos
selDepto.addEventListener("change", () => {
  actualizarSelectorMunicipios();
  aplicarFiltros();
});
document.getElementById("btnFiltrar").addEventListener("click", aplicarFiltros);
document.getElementById("btnLimpiar").addEventListener("click", () => {
  inputInicio.value = "";
  inputFin.value = "";
  selUsuario.value = "TODOS";
  selDepto.value = "TODOS";
  actualizarSelectorMunicipios();
  aplicarFiltros();
});
document.getElementById("btnExportarCSV").addEventListener("click", exportarCSV);

// Compatibilidad con carga de módulos ES6
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciarEstadisticas);
} else {
  iniciarEstadisticas();
}