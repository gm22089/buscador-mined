import { FirebaseManager } from './db/FirebaseManager.js';

const dbManager = new FirebaseManager();
const db = dbManager.db;

let listaUsuarios = [];
let mostrarPins = false;

const panelLogin = document.getElementById("panelLoginAdmin");
const contenidoAdmin = document.getElementById("contenidoAdmin");
const msgLogin = document.getElementById("msgLoginAdmin");
const estadoAdmin = document.getElementById("estadoAdmin");

async function autenticarAdmin() {
  const user = document.getElementById("adminUser").value.trim().toLowerCase();
  const pin = document.getElementById("adminPin").value.trim();
  msgLogin.textContent = "";

  if (!user || !pin) {
    msgLogin.textContent = "Ingresa usuario y PIN.";
    return;
  }

  try {
    const doc = await db.collection("usuarios_autorizados").doc(user).get();
    if (!doc.exists) {
      msgLogin.textContent = "❌ Usuario no encontrado.";
      return;
    }

    const data = doc.data();
    if (String(data.pin) !== pin) {
      msgLogin.textContent = "❌ PIN incorrecto.";
      return;
    }

    const nombre = (data.nombreMostrar || user).toUpperCase();
    const esAdmin = data.rol === "admin" || user === "user" || user === "usuario ad" || nombre === "USUARIO AD";

    if (!esAdmin) {
      msgLogin.textContent = "⛔ Este usuario no tiene permisos de administrador.";
      return;
    }

    panelLogin.style.display = "none";
    contenidoAdmin.style.display = "block";
    await cargarDatosAdmin();
  } catch (error) {
    console.error(error);
    msgLogin.textContent = `❌ Error: ${error.message}`;
  }
}

async function cargarDatosAdmin() {
  estadoAdmin.innerHTML = `<span style="color:#64748b;">⏳ Cargando usuarios y verificando caché de escuelas...</span>`;

  const [snapUsuarios] = await Promise.all([
    db.collection("usuarios_autorizados").get(),
    dbManager.cargarEstadosIniciales()
  ]);

  listaUsuarios = [];
  snapUsuarios.forEach(doc => {
    listaUsuarios.push({ id: doc.id, ...doc.data() });
  });
  listaUsuarios.sort((a, b) => a.id.localeCompare(b.id, 'es'));

  renderTablaUsuarios();
  poblarSelectorVariantes();

  const totalCEs = Object.keys(dbManager.diccionarioEstados).length;
  estadoAdmin.innerHTML = `<span class="estado-ok">✅ Conectado · ${listaUsuarios.length} usuarios autorizados y ${totalCEs} escuelas en memoria.</span>`;
}

function renderTablaUsuarios() {
  const tbody = document.getElementById("tbodyUsuariosAdmin");
  document.getElementById("totalUsuariosBD").textContent = listaUsuarios.length;

  tbody.innerHTML = listaUsuarios.map(u => {
    const rol = u.rol === "admin" || u.id === "usuario ad" ? "admin" : "tecnico";
    const pinTexto = mostrarPins ? escaparHTML(String(u.pin)) : "••••";

    return `
      <tr>
        <td><strong>${escaparHTML(u.id)}</strong></td>
        <td>${escaparHTML(u.nombreMostrar || u.id.toUpperCase())}</td>
        <td style="font-family:monospace;">${pinTexto}</td>
        <td><span class="badge-rol ${rol === 'admin' ? 'rol-admin' : 'rol-tecnico'}">${rol.toUpperCase()}</span></td>
        <td style="display:flex; gap:5px;">
          <button class="btn-mini btn-editar" onclick="window.editarUsuarioAdmin('${escaparHTML(u.id)}')">✏️ Editar</button>
          <button class="btn-mini btn-borrar" onclick="window.eliminarUsuarioAdmin('${escaparHTML(u.id)}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join("");
}

window.editarUsuarioAdmin = (id) => {
  const u = listaUsuarios.find(item => item.id === id);
  if (!u) return;
  document.getElementById("inputDocId").value = u.id;
  document.getElementById("inputDocId").disabled = true;
  document.getElementById("inputNombreMostrar").value = (u.nombreMostrar || u.id).toUpperCase();
  document.getElementById("inputPinUsuario").value = u.pin || "";
  document.getElementById("selectRolUsuario").value = u.rol || "tecnico";
  document.getElementById("tituloFormUsuario").textContent = `✏️ Editando: ${u.id}`;
};

function limpiarFormularioUsuario() {
  document.getElementById("inputDocId").value = "";
  document.getElementById("inputDocId").disabled = false;
  document.getElementById("inputNombreMostrar").value = "";
  document.getElementById("inputPinUsuario").value = "";
  document.getElementById("selectRolUsuario").value = "tecnico";
  document.getElementById("tituloFormUsuario").textContent = "➕ Agregar / Editar Usuario";
}

async function guardarUsuarioAdmin() {
  const id = document.getElementById("inputDocId").value.trim().toLowerCase();
  const nombreMostrar = document.getElementById("inputNombreMostrar").value.trim().toUpperCase();
  const pin = document.getElementById("inputPinUsuario").value.trim();
  const rol = document.getElementById("selectRolUsuario").value;

  if (!id || !nombreMostrar || !pin) {
    alert("Completa ID, Nombre visible y PIN.");
    return;
  }

  try {
    await db.collection("usuarios_autorizados").doc(id).set({
      nombreMostrar,
      pin,
      rol
    });
    limpiarFormularioUsuario();
    await cargarDatosAdmin();
    alert(`✅ Usuario "${nombreMostrar}" guardado correctamente.`);
  } catch (error) {
    alert(`❌ Error al guardar usuario: ${error.message}`);
  }
}

window.eliminarUsuarioAdmin = async (id) => {
  if (!confirm(`¿Seguro que deseas eliminar el acceso de "${id}"?`)) return;
  try {
    await db.collection("usuarios_autorizados").doc(id).delete();
    await cargarDatosAdmin();
  } catch (error) {
    alert(`❌ Error al eliminar: ${error.message}`);
  }
};

function poblarSelectorVariantes() {
  const sel = document.getElementById("selNombreOrigen");
  const nombresEnBD = new Set();

  Object.values(dbManager.diccionarioEstados).forEach(doc => {
    if (doc.usuario) nombresEnBD.add(doc.usuario);
    if (Array.isArray(doc.historial)) {
      doc.historial.forEach(h => {
        if (h.usuario) nombresEnBD.add(h.usuario);
      });
    }
  });

  const ordenados = [...nombresEnBD].sort((a, b) => a.localeCompare(b, 'es'));
  sel.innerHTML = ordenados.map(n => `<option value="${escaparHTML(n)}">${escaparHTML(n)}</option>`).join("");
}

async function unificarNombresBD() {
  const origen = document.getElementById("selNombreOrigen").value;
  const destino = document.getElementById("inputNombreDestino").value.trim().toUpperCase();
  const resText = document.getElementById("resultadoUnificacion");

  if (!origen || !destino) {
    alert("Selecciona el nombre variante y escribe el nombre oficial en mayúsculas.");
    return;
  }
  if (origen === destino) {
    alert("El nombre origen y destino son iguales.");
    return;
  }

  if (!confirm(`Se cambiará "${origen}" por "${destino}" en todas las escuelas registradas. ¿Continuar?`)) return;

  resText.textContent = "⏳ Actualizando registros...";
  let actualizados = 0;
  const ahora = Date.now();

  try {
    const batch = db.batch();

    Object.entries(dbManager.diccionarioEstados).forEach(([codigo, doc]) => {
      let modificado = false;
      const copia = { ...doc };

      if (copia.usuario === origen) {
        copia.usuario = destino;
        modificado = true;
      }

      if (Array.isArray(copia.historial)) {
        copia.historial = copia.historial.map(h => {
          if (h.usuario === origen) {
            modificado = true;
            return { ...h, usuario: destino };
          }
          return h;
        });
      }

      if (modificado) {
        copia.ultimaActualizacion = ahora;
        batch.set(db.collection("estados_escuelas").doc(codigo), copia);
        dbManager.diccionarioEstados[codigo] = copia;
        actualizados++;
      }
    });

    if (actualizados > 0) {
      await batch.commit();
      dbManager.guardarCacheLocal(ahora);
      poblarSelectorVariantes();
    }

    resText.innerHTML = `<span class="estado-ok">✅ Listo: se unificaron ${actualizados} centros educativos de "${escaparHTML(origen)}" a "${escaparHTML(destino)}".</span>`;
  } catch (error) {
    console.error(error);
    resText.innerHTML = `<span class="error">❌ Error al unificar: ${error.message}</span>`;
  }
}

function escaparHTML(str) {
  const div = document.createElement("div");
  div.innerText = str || "";
  return div.innerHTML;
}

document.getElementById("btnEntrarAdmin").addEventListener("click", autenticarAdmin);
document.getElementById("adminPin").addEventListener("keydown", e => { if (e.key === "Enter") autenticarAdmin(); });
document.getElementById("btnGuardarUsuario").addEventListener("click", guardarUsuarioAdmin);
document.getElementById("btnLimpiarForm").addEventListener("click", limpiarFormularioUsuario);
document.getElementById("chkVerPins").addEventListener("change", e => {
  mostrarPins = e.target.checked;
  renderTablaUsuarios();
});
document.getElementById("btnUnificarNombres").addEventListener("click", unificarNombresBD);