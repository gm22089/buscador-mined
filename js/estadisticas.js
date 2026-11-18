import { FirebaseManager } from './db/FirebaseManager.js';
import { MinedAPI } from './api/MinedAPI.js';

const db = new FirebaseManager();
const api = new MinedAPI();

let catalogoNacional = [];
let mapaPorCodigo = {};
let eventosBD = [];
let eventosFiltrados = [];

// Referencias DOM
const estadoBanner = document.getElementById("estadoDiccionario");
const inputInicio = document.getElementById("fechaInicio");
const inputFin = document.getElementById("fechaFin");
const selUsuario = document.getElementById("filtroUsuario");
const selTipo = document.getElementById("filtroTipo");
const selDepto = document.getElementById("filtroDepto");
const selMuni = document.getElementById("filtroMuni");
const selDistrito = document.getElementById("filtroDistrito");

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

    // Extraer cada evento del historial (visitas múltiples, remotos, intervenidos, desmontados, cerrados)
    eventosBD = [];
    Object.keys(estadosDict).forEach(codigo => {
      const info = db.getEstado(codigo);
      const ce = mapaPorCodigo[codigo] || {
        nombre: "Centro Educativo no encontrado en catálogo",
        departamento: "Sin Departamento",
        municipio: "Sin Municipio",
        distrito: "Sin Distrito"
      };

      info.historial.forEach(item => {
        // Omitir eventos internos de reinicio a "Sin Visitar"
        if (!item.accion || item.accion === "reiniciado" || item.accion === "normal") return;

        eventosBD.push({
          codigo,
          nombre: ce.nombre,
          departamento: ce.departamento,
          municipio: ce.municipio,
          distrito: ce.distrito,
          accion: item.accion,
          desmontado: Boolean(item.desmontado),
          fecha: item.fecha || "",
          usuario: (item.usuario || "Sin usuario").trim(),
          registradoEn: item.registradoEn || ""
        });
      });
    });

    poblarFiltros();
    aplicarFiltros();

    estadoBanner.innerHTML = `<span class="estado-ok">✅ Datos sincronizados (${catalogoNacional.length} centros en catálogo nacional · ${eventosBD.length} gestiones registradas).</span>`;
  } catch (error) {
    console.error("Error al iniciar estadísticas:", error);
    estadoBanner.innerHTML = `<span class="error">❌ Error al cargar estadísticas: ${error.message}</span>`;
  }
}

function poblarFiltros() {
  const usuariosUnicos = [...new Set(eventosBD.map(r => r.usuario))].sort((a, b) => a.localeCompare(b, 'es'));
  usuariosUnicos.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u;
    opt.textContent = u;
    selUsuario.appendChild(opt);
  });

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

  actualizarSelectorDistritos();
}

function actualizarSelectorDistritos() {
  const deptoSeleccionado = selDepto.value;
  const muniSeleccionado = selMuni.value;
  selDistrito.innerHTML = `<option value="TODOS">Todos los distritos</option>`;

  const base = catalogoNacional.filter(c => {
    if (deptoSeleccionado !== "TODOS" && c.departamento !== deptoSeleccionado) return false;
    if (muniSeleccionado !== "TODOS" && c.municipio !== muniSeleccionado) return false;
    return true;
  });

  const distritosUnicos = [...new Set(base.map(c => c.distrito))].sort((a, b) => a.localeCompare(b, 'es'));
  distritosUnicos.forEach(dist => {
    const opt = document.createElement("option");
    opt.value = dist;
    opt.textContent = dist;
    selDistrito.appendChild(opt);
  });
}

function aplicarFiltros() {
  const fInicio = inputInicio.value;
  const fFin = inputFin.value;
  const uSel = selUsuario.value;
  const tSel = selTipo.value;
  const dSel = selDepto.value;
  const mSel = selMuni.value;
  const distSel = selDistrito.value;

  eventosFiltrados = eventosBD.filter(r => {
    if (fInicio && (!r.fecha || r.fecha < fInicio)) return false;
    if (fFin && (!r.fecha || r.fecha > fFin)) return false;
    if (uSel !== "TODOS" && r.usuario !== uSel) return false;
    if (tSel !== "TODOS") {
      if (tSel === "desmontado") {
        if (!r.desmontado) return false;
      } else if (r.accion !== tSel) {
        return false;
      }
    }
    if (dSel !== "TODOS" && r.departamento !== dSel) return false;
    if (mSel !== "TODOS" && r.municipio !== mSel) return false;
    if (distSel !== "TODOS" && r.distrito !== distSel) return false;
    return true;
  });

  const catalogoFiltrado = catalogoNacional.filter(c => {
    if (dSel !== "TODOS" && c.departamento !== dSel) return false;
    if (mSel !== "TODOS" && c.municipio !== mSel) return false;
    if (distSel !== "TODOS" && c.distrito !== distSel) return false;
    return true;
  });

  renderKPIs(catalogoFiltrado, eventosFiltrados);
  renderTablaUsuarios(eventosFiltrados);
  renderTablaDepartamentos(catalogoFiltrado, eventosFiltrados);
  renderTablaMunicipios(catalogoFiltrado, eventosFiltrados);
  renderTablaDistritos(catalogoFiltrado, eventosFiltrados);
  renderTablaDetalle(eventosFiltrados);
}

function renderKPIs(catalogoBase, filtrados) {
  const totalCE = catalogoBase.length;

  const eventosVisita = filtrados.filter(r => r.accion === "visitado");
  const cesUnicosVisitados = new Set(eventosVisita.map(r => r.codigo)).size;
  const porcentaje = totalCE > 0 ? ((cesUnicosVisitados / totalCE) * 100).toFixed(2) : "0.00";

  const eventosRemoto = filtrados.filter(r => r.accion === "remoto");
  const cesUnicosRemoto = new Set(eventosRemoto.map(r => r.codigo)).size;

  const intervenidos = filtrados.filter(r => r.accion === "intervenido").length;
  const desmontados = filtrados.filter(r => r.desmontado).length;
  const cerrados = filtrados.filter(r => r.accion === "cerrado").length;

  document.getElementById("kpiTotal").textContent = totalCE.toLocaleString();
  document.getElementById("kpiVisitados").textContent = cesUnicosVisitados.toLocaleString();
  document.getElementById("kpiVisitadosDetalle").textContent = `${porcentaje}% cobertura · ${eventosVisita.length} visitas en total`;

  document.getElementById("kpiRemotos").textContent = eventosRemoto.length.toLocaleString();
  document.getElementById("kpiRemotosDetalle").textContent = `En ${cesUnicosRemoto} centros educativos`;

  document.getElementById("kpiOtros").textContent = intervenidos.toLocaleString();
  document.getElementById("kpiOtrosDetalle").textContent = `${desmontados} desmontados · ${cerrados} cerrados`;
}

function renderTablaUsuarios(filtrados) {
  const tbody = document.getElementById("tbodyUsuarios");
  const mapaUsuarios = {};

  filtrados.forEach(r => {
    if (!mapaUsuarios[r.usuario]) {
      mapaUsuarios[r.usuario] = {
        nombre: r.usuario,
        visitado: 0,
        remoto: 0,
        intervenido: 0,
        desmontado: 0,
        cerrado: 0,
        cesUnicos: new Set(),
        total: 0
      };
    }

    const u = mapaUsuarios[r.usuario];
    if (r.accion === "visitado") u.visitado++;
    if (r.accion === "remoto") u.remoto++;
    if (r.accion === "intervenido") u.intervenido++;
    if (r.desmontado) u.desmontado++;
    if (r.accion === "cerrado") u.cerrado++;

    u.cesUnicos.add(r.codigo);
    u.total++;
  });

  const lista = Object.values(mapaUsuarios).sort((a, b) => b.total - a.total);

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#64748b;">Sin registros en el rango seleccionado</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(u => `
    <tr>
      <td><strong>${escaparHTML(u.nombre)}</strong></td>
      <td><span class="pill-estado pill-visitado">${u.visitado}</span></td>
      <td><span class="pill-estado pill-remoto">${u.remoto}</span></td>
      <td><span class="pill-estado pill-intervenido">${u.intervenido}</span></td>
      <td><span class="pill-estado pill-desmontado">${u.desmontado}</span></td>
      <td><span class="pill-estado pill-cerrado">${u.cerrado}</span></td>
      <td><strong>${u.cesUnicos.size}</strong></td>
      <td><strong>${u.total}</strong></td>
    </tr>
  `).join("");
}

function renderTablaDepartamentos(catalogoBase, filtrados) {
  const tbody = document.getElementById("tbodyDeptos");
  const stats = {};

  catalogoBase.forEach(c => {
    if (!stats[c.departamento]) {
      stats[c.departamento] = { nombre: c.departamento, total: 0, visitadosSet: new Set() };
    }
    stats[c.departamento].total++;
  });

  filtrados.forEach(r => {
    if (r.accion === "visitado" && stats[r.departamento]) {
      stats[r.departamento].visitadosSet.add(r.codigo);
    }
  });

  const lista = Object.values(stats).sort((a, b) => (b.visitadosSet.size / b.total) - (a.visitadosSet.size / a.total));

  tbody.innerHTML = lista.map(d => {
    const cant = d.visitadosSet.size;
    const pct = d.total > 0 ? ((cant / d.total) * 100).toFixed(1) : 0;
    return `
      <tr>
        <td><strong>${escaparHTML(d.nombre)}</strong></td>
        <td>${cant} / ${d.total}</td>
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
    if (!stats[key]) {
      stats[key] = { municipio: c.municipio, depto: c.departamento, total: 0, visitadosSet: new Set() };
    }
    stats[key].total++;
  });

  filtrados.forEach(r => {
    const key = `${r.departamento}|${r.municipio}`;
    if (r.accion === "visitado" && stats[key]) {
      stats[key].visitadosSet.add(r.codigo);
    }
  });

  const lista = Object.values(stats).sort((a, b) => (b.visitadosSet.size / b.total) - (a.visitadosSet.size / a.total));

  tbody.innerHTML = lista.map(m => {
    const cant = m.visitadosSet.size;
    const pct = m.total > 0 ? ((cant / m.total) * 100).toFixed(1) : 0;
    return `
      <tr>
        <td><strong>${escaparHTML(m.municipio)}</strong> <span style="font-size:11px; color:#64748b;">(${escaparHTML(m.depto)})</span></td>
        <td>${cant} / ${m.total}</td>
        <td>
          <strong>${pct}%</strong>
          <div class="barra-progreso"><div class="barra-progreso-fill" style="width:${Math.min(pct, 100)}%"></div></div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderTablaDistritos(catalogoBase, filtrados) {
  const tbody = document.getElementById("tbodyDistritos");
  const stats = {};

  catalogoBase.forEach(c => {
    const key = `${c.departamento}|${c.municipio}|${c.distrito}`;
    if (!stats[key]) {
      stats[key] = { distrito: c.distrito, municipio: c.municipio, depto: c.departamento, total: 0, visitadosSet: new Set() };
    }
    stats[key].total++;
  });

  filtrados.forEach(r => {
    const key = `${r.departamento}|${r.municipio}|${r.distrito}`;
    if (r.accion === "visitado" && stats[key]) {
      stats[key].visitadosSet.add(r.codigo);
    }
  });

  const lista = Object.values(stats).sort((a, b) => (b.visitadosSet.size / b.total) - (a.visitadosSet.size / a.total));

  tbody.innerHTML = lista.map(dist => {
    const cant = dist.visitadosSet.size;
    const pct = dist.total > 0 ? ((cant / dist.total) * 100).toFixed(1) : 0;
    return `
      <tr>
        <td><strong>${escaparHTML(dist.distrito)}</strong> <span style="font-size:11px; color:#64748b;">(${escaparHTML(dist.municipio)})</span></td>
        <td>${cant} / ${dist.total}</td>
        <td>
          <strong>${pct}%</strong>
          <div class="barra-progreso"><div class="barra-progreso-fill" style="width:${Math.min(pct, 100)}%"></div></div>
        </td>
      </tr>
    `;
  }).join("");
}

function formatearPillGestion(r) {
  if (r.accion === "visitado") return `<span class="pill-estado pill-visitado">✓ VISITADO</span>`;
  if (r.accion === "remoto") return `<span class="pill-estado pill-remoto">💻 REMOTO</span>`;
  if (r.accion === "intervenido") return `<span class="pill-estado pill-intervenido">🟠 INTERVENIDO</span>`;
  if (r.accion === "cerrado") return `<span class="pill-estado pill-cerrado">🔴 CERRADO</span>`;
  return `<span class="pill-estado pill-normal">${escaparHTML(r.accion.toUpperCase())}</span>`;
}

function renderTablaDetalle(filtrados) {
  const tbody = document.getElementById("tbodyDetalle");
  document.getElementById("totalDetalle").textContent = filtrados.length;

  if (!filtrados.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#64748b;">No hay gestiones para los filtros seleccionados.</td></tr>`;
    return;
  }

  const ordenados = [...filtrados].sort((a, b) => {
    const cmpFecha = b.fecha.localeCompare(a.fecha);
    if (cmpFecha !== 0) return cmpFecha;
    return b.registradoEn.localeCompare(a.registradoEn);
  });

  tbody.innerHTML = ordenados.map(r => `
    <tr>
      <td><a href="index.html?ce=${encodeURIComponent(r.codigo)}" target="_blank" style="font-weight:700; color:#1b365d;">${escaparHTML(r.codigo)}</a></td>
      <td>${escaparHTML(r.nombre)}</td>
      <td>${escaparHTML(r.departamento)}</td>
      <td>${escaparHTML(r.municipio)}</td>
      <td>${escaparHTML(r.distrito)}</td>
      <td>${formatearPillGestion(r)}</td>
      <td>${r.desmontado ? `<span class="pill-estado pill-desmontado">🔧 SÍ</span>` : `<span style="color:#94a3b8;">No</span>`}</td>
      <td>${escaparHTML(r.fecha)}</td>
      <td><strong>${escaparHTML(r.usuario)}</strong></td>
    </tr>
  `).join("");
}

function exportarCSV() {
  if (!eventosFiltrados.length) return alert("No hay datos filtrados para exportar.");

  const headers = ["INFRA", "Centro Educativo", "Departamento", "Municipio", "Distrito", "Gestion", "Desmontado", "Fecha", "Tecnico"];
  const filas = eventosFiltrados.map(r => [
    r.codigo,
    `"${r.nombre.replace(/"/g, '""')}"`,
    `"${r.departamento}"`,
    `"${r.municipio}"`,
    `"${r.distrito}"`,
    r.accion.toUpperCase(),
    r.desmontado ? "SI" : "NO",
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

selDepto.addEventListener("change", () => {
  actualizarSelectorMunicipios();
  aplicarFiltros();
});
selMuni.addEventListener("change", () => {
  actualizarSelectorDistritos();
  aplicarFiltros();
});
selDistrito.addEventListener("change", aplicarFiltros);
selTipo.addEventListener("change", aplicarFiltros);

document.getElementById("btnFiltrar").addEventListener("click", aplicarFiltros);
document.getElementById("btnLimpiar").addEventListener("click", () => {
  inputInicio.value = "";
  inputFin.value = "";
  selUsuario.value = "TODOS";
  selTipo.value = "TODOS";
  selDepto.value = "TODOS";
  actualizarSelectorMunicipios();
  aplicarFiltros();
});
document.getElementById("btnExportarCSV").addEventListener("click", exportarCSV);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciarEstadisticas);
} else {
  iniciarEstadisticas();
}