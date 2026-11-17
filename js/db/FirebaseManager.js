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
    return this.diccionarioEstados[codigo] || { estado: "normal", fecha: "N/A", usuario: "" };
  }

  // Consulta la colección 'usuarios_autorizados' en Firebase Firestore
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

  async guardarEstado(codigo, nuevoEstado, fechaPersonalizada = null) {
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

    const datos = { 
      estado: nuevoEstado, 
      fecha: fechaRegistro, 
      usuario: this.usuarioActual 
    };

    await this.db.collection("estados_escuelas").doc(String(codigo)).set(datos);
    this.diccionarioEstados[codigo] = datos;
    return datos;
  }
}