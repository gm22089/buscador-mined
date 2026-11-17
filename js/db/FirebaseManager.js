export class FirebaseManager {
  constructor() {
    const firebaseConfig = {
      apiKey: "AIzaSyDIt5mSMVOeqq-jexO5QOGC52NgAI3csHc",
      authDomain: "mapa-mined.firebaseapp.com",
      projectId: "mapa-mined",
      storageBucket: "mapa-mined.firebasestorage.app",
      messagingSenderId: "89748539625",
      appId: "1:89748539625:web:510fbb887563d0f4ca4878"
    };

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    
    this.db = firebase.firestore();
    this.diccionarioEstados = {};
    this.usuarioActual = localStorage.getItem("usuario_ce_mapa") || null;
  }

  obtenerFechaLocal() {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  async cargarEstadosIniciales() {
    try {
      const snapshot = await this.db.collection("estados_escuelas").get();
      snapshot.forEach(doc => {
        this.diccionarioEstados[doc.id] = doc.data();
      });
      return this.diccionarioEstados;
    } catch (error) {
      console.error("Error conectando a Firebase:", error);
      return {};
    }
  }

  getEstado(codigo) {
    const raw = this.diccionarioEstados[codigo];
    if (!raw) {
      return {
        estado: "normal",
        desmontado: false,
        fecha: "N/A",
        usuario: "",
        totalVisitas: 0,
        historial: []
      };
    }

    // Respalda automáticamente registros antiguos que aún no tenían arreglo 'historial'
    let historial = Array.isArray(raw.historial) ? [...raw.historial] : [];
    if (historial.length === 0 && raw.estado && raw.estado !== "normal") {
      historial.push({
        accion: raw.estado,
        desmontado: Boolean(raw.desmontado),
        fecha: raw.fecha || "",
        usuario: raw.usuario || "Sin usuario"
      });
    }

    const totalVisitas = historial.filter(h => h.accion === "visitado").length;

    return {
      estado: raw.estado || "normal",
      desmontado: Boolean(raw.desmontado),
      fecha: raw.fecha || "N/A",
      usuario: raw.usuario || "",
      totalVisitas,
      historial
    };
  }

  async verificarUsuarioEnFirebase(usuarioID, pin) {
    const idLimpio = usuarioID.trim().toLowerCase();
    const docRef = await this.db.collection("usuarios_autorizados").doc(idLimpio).get();

    if (!docRef.exists) {
      throw new Error("❌ El usuario no está autorizado en el sistema.");
    }

    const datosUsuario = docRef.data();
    if (String(datosUsuario.pin) !== String(pin).trim()) {
      throw new Error("❌ Clave/PIN incorrecta.");
    }

    return datosUsuario.nombreMostrar || usuarioID;
  }

  async guardarEstado(codigo, nuevoEstado, fechaPersonalizada = null, opciones = {}) {
    if (!this.usuarioActual) {
      const usuarioInput = prompt("Ingresa tu usuario:");
      if (!usuarioInput) throw new Error("Debes ingresar un usuario para guardar.");

      const pinInput = prompt("Ingresa tu clave/PIN de acceso:");
      if (!pinInput) throw new Error("Debes ingresar tu clave.");

      const nombreVerificado = await this.verificarUsuarioEnFirebase(usuarioInput, pinInput);

      this.usuarioActual = nombreVerificado;
      localStorage.setItem("usuario_ce_mapa", this.usuarioActual);
    }

    const fechaRegistro = (fechaPersonalizada && fechaPersonalizada.trim() !== "")
      ? fechaPersonalizada.trim()
      : this.obtenerFechaLocal();

    const actual = this.getEstado(codigo);
    const historial = [...actual.historial];
    const esDesmontado = (nuevoEstado === "intervenido") ? Boolean(opciones.desmontado) : false;

    if (nuevoEstado !== "normal") {
      // Evita duplicar exactamente el mismo registro (mismo técnico + misma fecha + misma acción)
      const yaExisteIdentico = historial.some(item =>
        item.accion === nuevoEstado &&
        item.fecha === fechaRegistro &&
        (item.usuario || "").toLowerCase() === this.usuarioActual.toLowerCase() &&
        Boolean(item.desmontado) === esDesmontado
      );

      if (yaExisteIdentico) {
        throw new Error(`⚠️ Ya existe un registro de "${nuevoEstado}" por ${this.usuarioActual} en la fecha ${fechaRegistro}. Si es una nueva visita, selecciona otra fecha.`);
      }

      historial.push({
        accion: nuevoEstado,
        desmontado: esDesmontado,
        fecha: fechaRegistro,
        usuario: this.usuarioActual,
        registradoEn: new Date().toISOString()
      });
    } else if (actual.estado !== "normal") {
      // Si pasa de intervenido/visitado/cerrado a "Sin Visitar", guarda el evento en el respaldo
      historial.push({
        accion: "reiniciado",
        desmontado: false,
        fecha: fechaRegistro,
        usuario: this.usuarioActual,
        registradoEn: new Date().toISOString()
      });
    }

    const totalVisitas = historial.filter(h => h.accion === "visitado").length;

    const datos = {
      estado: nuevoEstado,
      desmontado: esDesmontado,
      fecha: fechaRegistro,
      usuario: this.usuarioActual,
      totalVisitas,
      historial
    };

    await this.db.collection("estados_escuelas").doc(String(codigo)).set(datos);
    this.diccionarioEstados[codigo] = datos;
    return datos;
  }
}