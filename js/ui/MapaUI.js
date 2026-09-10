export class MapaUI {
  constructor(idContenedor) {
    this.diccionarioMarcadores = {};
    this.codigoSeleccionadoActual = null;

    const mapaCalles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 });
    const mapaSatelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 });

    this.mapa = L.map(idContenedor, {
      center: [13.794185, -88.89653],
      zoom: 8,
      layers: [mapaCalles]
    });

    L.control.layers({ "🗺️ Mapa Estándar": mapaCalles, "🛰️ Vista Satelital": mapaSatelite }).addTo(this.mapa);
    this.capaPines = L.featureGroup().addTo(this.mapa);
  }

  crearIcono(esSeleccionado = false, estadoBD = "normal") {
    let color = "#14375E"; 
    if (!esSeleccionado) {
      if (estadoBD === "visitado") color = "#28a745";
      if (estadoBD === "intervenido") color = "#fd7e14";
      if (estadoBD === "cerrado") color = "#dc3545";
    } else {
      color = "#B8892B"; 
    }

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

  limpiarMapaYLista() {
    this.capaPines.clearLayers();
    this.diccionarioMarcadores = {};
    this.codigoSeleccionadoActual = null;
    document.getElementById("listaCentrosMapeados").innerHTML = "";
    document.getElementById("contenedorListaMapeados").style.display = "none";
  }

  extraerCoordenadas(url) {
    if (!url || typeof url !== "string") return null;
    const match = url.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/) || url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) return { lat: match[1], lng: match[2] };
    return null;
  }

  escaparHTML(str) {
    const div = document.createElement("div");
    div.innerText = str;
    return div.innerHTML;
  }

  dibujarPines(filas, dbManager) {
    this.limpiarMapaYLista();
    let puntosEncontrados = 0;
    let htmlItems = "";

    filas.forEach(fila => {
      const [codigo, nombre, distrito, direccion, googleLink, wazeLink] = fila;
      const coords = this.extraerCoordenadas(wazeLink || googleLink);

      if (coords && codigo) {
        puntosEncontrados++;
        const infoBD = dbManager.getEstado(codigo);
        const colorEstado = infoBD.estado;
        
        let textoEstado = "Sin Visitar";
        if (colorEstado === "visitado") textoEstado = `Visitado el ${infoBD.fecha}`;
        if (colorEstado === "intervenido") textoEstado = `Intervenido el ${infoBD.fecha}`;
        if (colorEstado === "cerrado") textoEstado = `Cerrado el ${infoBD.fecha}`;

        const marcador = L.marker([parseFloat(coords.lat), parseFloat(coords.lng)], {
          icon: this.crearIcono(false, colorEstado)
        });

        const popupContenido = `
          <div class="popup-mined" style="min-width: 220px;">
            <h4 style="margin: 0 0 5px 0; color: #14375E;">INFRA: ${this.escaparHTML(String(codigo))}</h4>
            <p style="margin: 0 0 5px 0; font-weight: bold; font-size: 13px;">${this.escaparHTML(nombre || "Sin nombre")}</p>
            <p style="margin: 0 0 5px 0; font-size: 11px; color: #666;"><strong>Distrito:</strong> ${this.escaparHTML(distrito || "")}</p>
            
            <div style="background: #e2e8f0; padding: 8px; border-radius: 4px; margin-bottom: 10px;">
              <p style="margin: 0 0 5px 0; font-size: 11px; color: #333;"><strong>Estado:</strong> <span id="label_estado_${codigo}">${textoEstado}</span></p>
              <select id="select_estado_${codigo}" style="width: 100%; padding: 4px; font-size: 11px; margin-bottom:5px;">
                 <option value="normal" ${colorEstado === 'normal' ? 'selected' : ''}>Sin Visitar</option>
                 <option value="visitado" ${colorEstado === 'visitado' ? 'selected' : ''}>Visitado (Verde)</option>
                 <option value="intervenido" ${colorEstado === 'intervenido' ? 'selected' : ''}>Intervenido (Naranja)</option>
                 <option value="cerrado" ${colorEstado === 'cerrado' ? 'selected' : ''}>Cerrado (Rojo)</option>
              </select>
              <button onclick="window.guardarEstadoBD('${codigo}')" style="width: 100%; font-size: 11px; cursor: pointer;">Guardar Cambio</button>
            </div>
            <button onclick="window.llevarAlBuscador('${this.escaparHTML(String(codigo))}')" style="display:block; width: 100%; padding: 6px; background: #B8892B; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Ver Expediente</button>
          </div>
        `;
        
        marcador.bindPopup(popupContenido);
        marcador.on('click', () => window.seleccionarCentro(codigo, false));
        this.capaPines.addLayer(marcador);

        this.diccionarioMarcadores[codigo] = { marcador, datos: { codigo, nombre, distrito } };

        htmlItems += `
          <div class="item-centro-card" id="card-ce-${codigo}" onclick="window.seleccionarCentro('${codigo}', true)">
            <div class="card-head">
              <span class="badge-infra">${this.escaparHTML(String(codigo))}</span>
              <button class="btn-ver-expediente" onclick="event.stopPropagation(); window.llevarAlBuscador('${this.escaparHTML(String(codigo))}')">Expediente ↗</button>
            </div>
            <div class="card-body">
              <strong>${this.escaparHTML(nombre || "Sin nombre")}</strong>
              <small>${this.escaparHTML(distrito || "")}</small>
            </div>
          </div>
        `;
      }
    });

    if (puntosEncontrados > 0) {
      document.getElementById("listaCentrosMapeados").innerHTML = htmlItems;
      document.getElementById("totalMapeados").innerText = puntosEncontrados;
      document.getElementById("contenedorListaMapeados").style.display = "block";
      this.mapa.fitBounds(this.capaPines.getBounds(), { padding: [30, 30] });
    }
    return puntosEncontrados;
  }

  seleccionar(codigo, dbManager, moverCamara = true) {
    if (!this.diccionarioMarcadores[codigo]) return;

    if (this.codigoSeleccionadoActual && this.diccionarioMarcadores[this.codigoSeleccionadoActual]) {
      const prevObj = this.diccionarioMarcadores[this.codigoSeleccionadoActual];
      const estadoPrevio = dbManager.getEstado(this.codigoSeleccionadoActual).estado;
      prevObj.marcador.setIcon(this.crearIcono(false, estadoPrevio));
      prevObj.marcador.setZIndexOffset(0);
      const prevCard = document.getElementById(`card-ce-${this.codigoSeleccionadoActual}`);
      if (prevCard) prevCard.classList.remove("activa");
    }

    this.codigoSeleccionadoActual = codigo;
    const itemActual = this.diccionarioMarcadores[codigo];
    const estadoActual = dbManager.getEstado(codigo).estado;
    
    itemActual.marcador.setIcon(this.crearIcono(true, estadoActual));
    itemActual.marcador.setZIndexOffset(1000);

    const cardActual = document.getElementById(`card-ce-${codigo}`);
    if (cardActual) {
      cardActual.classList.add("activa");
      cardActual.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (moverCamara) {
      this.mapa.setView(itemActual.marcador.getLatLng(), 16, { animate: true });
      itemActual.marcador.openPopup();
    }
  }
}