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
        totalRemotos: 0,
        historial: []
      };
    }

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
    const totalRemotos = historial.filter(h => h.accion === "remoto").length;

    return {
      estado: raw.estado || "normal",
      desmontado: Boolean(raw.desmontado),
      fecha: raw.fecha || "N/A",
      usuario: raw.usuario || "",
      totalVisitas,
      totalRemotos,
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

  async asegurarSesion() {
    if (!this.usuarioActual) {
      const usuarioInput = prompt("Ingresa tu usuario:");
      if (!usuarioInput) throw new Error("Debes ingresar un usuario para guardar.");

      const pinInput = prompt("Ingresa tu clave/PIN de acceso:");
      if (!pinInput) throw new Error("Debes ingresar tu clave.");

      const nombreVerificado = await this.verificarUsuarioEnFirebase(usuarioInput, pinInput);
      this.usuarioActual = nombreVerificado;
      localStorage.setItem("usuario_ce_mapa", this.usuarioActual);
    }
  }

  async guardarEstado(codigo, nuevoEstado, fechaPersonalizada = null, opciones = {}) {
    await this.asegurarSesion();

    const fechaRegistro = (fechaPersonalizada && fechaPersonalizada.trim() !== "")
      ? fechaPersonalizada.trim()
      : this.obtenerFechaLocal();

    const actual = this.getEstado(codigo);
    const historial = [...actual.historial];
    const esDesmontado = (nuevoEstado === "intervenido") ? Boolean(opciones.desmontado) : false;

    if (nuevoEstado !== "normal") {
      const yaExisteIdentico = historial.some(item =>
        item.accion === nuevoEstado &&
        item.fecha === fechaRegistro &&
        (item.usuario || "").toLowerCase() === this.usuarioActual.toLowerCase() &&
        Boolean(item.desmontado) === esDesmontado
      );

      if (yaExisteIdentico) {
        throw new Error(`⚠️ Ya registraste "${nuevoEstado}" en la fecha ${fechaRegistro}. Si deseas agregar otro registro, selecciona una fecha distinta.`);
      }

      historial.push({
        accion: nuevoEstado,
        desmontado: esDesmontado,
        fecha: fechaRegistro,
        usuario: this.usuarioActual,
        registradoEn: new Date().toISOString()
      });
    } else if (actual.estado !== "normal") {
      historial.push({
        accion: "reiniciado",
        desmontado: false,
        fecha: fechaRegistro,
        usuario: this.usuarioActual,
        registradoEn: new Date().toISOString()
      });
    }

    // Si el CE ya estaba "visitado" y se registra un trabajo "remoto" rápido, conserva el estado "visitado"
    let estadoFinal = nuevoEstado;
    if (nuevoEstado === "remoto" && opciones.mantenerVisitado && actual.estado === "visitado") {
      estadoFinal = "visitado";
    }

    const totalVisitas = historial.filter(h => h.accion === "visitado").length;
    const totalRemotos = historial.filter(h => h.accion === "remoto").length;

    const datos = {
      estado: estadoFinal,
      desmontado: estadoFinal === "intervenido" ? esDesmontado : false,
      fecha: fechaRegistro,
      usuario: this.usuarioActual,
      totalVisitas,
      totalRemotos,
      historial
    };

    await this.db.collection("estados_escuelas").doc(String(codigo)).set(datos);
    this.diccionarioEstados[codigo] = datos;
    return this.getEstado(codigo);
  }

  // Permite corregir una fecha mal ingresada directamente desde el historial
  async editarFechaHistorial(codigo, indiceReal, nuevaFecha) {
    await this.asegurarSesion();

    if (!nuevaFecha || !/^\d{4}-\d{2}-\d{2}$/.test(nuevaFecha)) {
      throw new Error("❌ Selecciona una fecha válida.");
    }

    const actual = this.getEstado(codigo);
    const historial = [...actual.historial];

    if (!historial[indiceReal]) {
      throw new Error("❌ No se encontró el registro en el historial.");
    }

    historial[indiceReal] = {
      ...historial[indiceReal],
      fecha: nuevaFecha,
      editadoPor: this.usuarioActual
    };

    // Si se editó el último registro, actualizar también la fecha principal del documento
    const esUltimo = indiceReal === historial.length - 1;
    const fechaPrincipal = esUltimo ? nuevaFecha : actual.fecha;

    const totalVisitas = historial.filter(h => h.accion === "visitado").length;
    const totalRemotos = historial.filter(h => h.accion === "remoto").length;

    const datos = {
      estado: actual.estado,
      desmontado: actual.desmontado,
      fecha: fechaPrincipal,
      usuario: actual.usuario,
      totalVisitas,
      totalRemotos,
      historial
    };

    await this.db.collection("estados_escuelas").doc(String(codigo)).set(datos);
    this.diccionarioEstados[codigo] = datos;
    return this.getEstado(codigo);
  }

  // Permite eliminar un registro equivocado del historial
  async eliminarRegistroHistorial(codigo, indiceReal) {
    await this.asegurarSesion();

    const actual = this.getEstado(codigo);
    const historial = [...actual.historial];

    if (!historial[indiceReal]) return actual;

    historial.splice(indiceReal, 1);

    const totalVisitas = historial.filter(h => h.accion === "visitado").length;
    const totalRemotos = historial.filter(h => h.accion === "remoto").length;
    const ultimo = historial[historial.length - 1];

    let nuevoEstado = "normal";
    let nuevaFecha = "N/A";
    let nuevoUsuario = "";
    let nuevoDesmontado = false;

    if (ultimo) {
      nuevoEstado = ultimo.accion === "reiniciado" ? "normal" : ultimo.accion;
      nuevaFecha = ultimo.fecha || "N/A";
      nuevoUsuario = ultimo.usuario || "";
      nuevoDesmontado = Boolean(ultimo.desmontado);
    }

    const datos = {
      estado: nuevoEstado,
      desmontado: nuevoDesmontado,
      fecha: nuevaFecha,
      usuario: nuevoUsuario,
      totalVisitas,
      totalRemotos,
      historial
    };

    await this.db.collection("estados_escuelas").doc(String(codigo)).set(datos);
    this.diccionarioEstados[codigo] = datos;
    return this.getEstado(codigo);
  }
}