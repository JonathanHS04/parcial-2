CREATE SCHEMA pharma AUTHORIZATION app_user;

CREATE TABLE pharma.productos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  principio_activo_id INT,
  categoria TEXT,
  creado_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pharma.lotes (
  id SERIAL PRIMARY KEY,
  producto_id INT REFERENCES pharma.productos(id),
  codigo_lote TEXT NOT NULL,
  cantidad INT NOT NULL CHECK (cantidad >= 0),
  fecha_vencimiento DATE NOT NULL,
  precio NUMERIC(12,2) NOT NULL,
  estado SMALLINT NOT NULL DEFAULT 1, -- 1: disponible, 2: reservado, 3: bloqueado
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lotes_producto_venc ON pharma.lotes(producto_id, fecha_vencimiento);

CREATE UNIQUE INDEX ux_lotes_codigo ON pharma.lotes(codigo_lote);

CREATE TABLE pharma.ordenes (
  id SERIAL PRIMARY KEY,
  tipo SMALLINT NOT NULL, -- 1: compra, 2: venta
  usuario_id INT NOT NULL,
  estado SMALLINT NOT NULL DEFAULT 1, -- 1: pendiente, 2: completada, 3: cancelada
  total NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pharma.orden_items (
  id SERIAL PRIMARY KEY,
  orden_id INT REFERENCES pharma.ordenes(id) ON DELETE CASCADE,
  lote_id INT REFERENCES pharma.lotes(id),
  cantidad INT NOT NULL,
  precio_unit NUMERIC(12,2) NOT NULL
);

CREATE INDEX idx_orden_items_lote ON pharma.orden_items(lote_id);

-- ========================================
-- FUNCIONES Y TRIGGERS PARA CONCURRENCIA
-- ========================================

-- Función para actualizar automáticamente updated_at
CREATE OR REPLACE FUNCTION pharma.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at en lotes
CREATE TRIGGER trigger_lotes_updated_at
  BEFORE UPDATE ON pharma.lotes
  FOR EACH ROW
  EXECUTE FUNCTION pharma.update_timestamp();

-- Función para incrementar versión automáticamente
CREATE OR REPLACE FUNCTION pharma.increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para control de versión optimista en lotes
CREATE TRIGGER trigger_lotes_version
  BEFORE UPDATE ON pharma.lotes
  FOR EACH ROW
  EXECUTE FUNCTION pharma.increment_version();

-- Función para validar cantidad no negativa
CREATE OR REPLACE FUNCTION pharma.validate_cantidad()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cantidad < 0 THEN
    RAISE EXCEPTION 'La cantidad no puede ser negativa: %', NEW.cantidad;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar cantidad en lotes
CREATE TRIGGER trigger_lotes_validate_cantidad
  BEFORE INSERT OR UPDATE ON pharma.lotes
  FOR EACH ROW
  EXECUTE FUNCTION pharma.validate_cantidad();

-- Función para auditar cambios en inventario
CREATE TABLE IF NOT EXISTS pharma.auditoria_lotes (
  id SERIAL PRIMARY KEY,
  lote_id INT,
  operacion TEXT NOT NULL,
  cantidad_anterior INT,
  cantidad_nueva INT,
  version_anterior INT,
  version_nueva INT,
  usuario TEXT,
  timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION pharma.audit_lote_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO pharma.auditoria_lotes (
      lote_id, 
      operacion, 
      cantidad_anterior, 
      cantidad_nueva,
      version_anterior,
      version_nueva,
      usuario
    ) VALUES (
      NEW.id,
      'UPDATE',
      OLD.cantidad,
      NEW.cantidad,
      OLD.version,
      NEW.version,
      current_user
    );
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO pharma.auditoria_lotes (
      lote_id, 
      operacion, 
      cantidad_anterior, 
      cantidad_nueva,
      version_anterior,
      version_nueva,
      usuario
    ) VALUES (
      NEW.id,
      'INSERT',
      NULL,
      NEW.cantidad,
      NULL,
      NEW.version,
      current_user
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auditoría de lotes
CREATE TRIGGER trigger_lotes_audit
  AFTER INSERT OR UPDATE ON pharma.lotes
  FOR EACH ROW
  EXECUTE FUNCTION pharma.audit_lote_changes();

-- Vista para consultar stock disponible con información agregada
CREATE OR REPLACE VIEW pharma.vista_stock_disponible AS
SELECT 
  p.id as producto_id,
  p.nombre as producto_nombre,
  p.categoria,
  COUNT(l.id) as num_lotes,
  SUM(l.cantidad) as stock_total,
  MIN(l.fecha_vencimiento) as proxima_vencimiento,
  AVG(l.precio) as precio_promedio
FROM pharma.productos p
LEFT JOIN pharma.lotes l ON p.id = l.producto_id
  AND l.estado = 1
  AND l.cantidad > 0
  AND l.fecha_vencimiento >= CURRENT_DATE
GROUP BY p.id, p.nombre, p.categoria;

-- Índice para mejorar consultas de auditoría
CREATE INDEX idx_auditoria_lotes_lote_id ON pharma.auditoria_lotes(lote_id);
CREATE INDEX idx_auditoria_lotes_timestamp ON pharma.auditoria_lotes(timestamp DESC);

-- Función para obtener lotes disponibles por producto (FIFO por vencimiento)
CREATE OR REPLACE FUNCTION pharma.get_lotes_disponibles(p_producto_id INT)
RETURNS TABLE (
  lote_id INT,
  codigo_lote TEXT,
  cantidad INT,
  precio NUMERIC,
  fecha_vencimiento DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.codigo_lote,
    l.cantidad,
    l.precio,
    l.fecha_vencimiento
  FROM pharma.lotes l
  WHERE l.producto_id = p_producto_id
    AND l.estado = 1
    AND l.cantidad > 0
    AND l.fecha_vencimiento >= CURRENT_DATE
  ORDER BY l.fecha_vencimiento ASC
  FOR UPDATE SKIP LOCKED; -- Evitar bloqueos en consultas concurrentes
END;
$$ LANGUAGE plpgsql;

-- Función para reservar lote atómicamente
CREATE OR REPLACE FUNCTION pharma.reservar_lote(
  p_lote_id INT,
  p_cantidad INT,
  p_version_esperada INT
)
RETURNS TABLE (
  success BOOLEAN,
  new_version INT,
  new_cantidad INT,
  message TEXT
) AS $$
DECLARE
  v_lote RECORD;
BEGIN
  -- Bloquear el lote para actualización
  SELECT * INTO v_lote
  FROM pharma.lotes
  WHERE id = p_lote_id
  FOR UPDATE;
  
  -- Verificar que existe
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::INT, NULL::INT, 'Lote no encontrado';
    RETURN;
  END IF;
  
  -- Verificar versión (control optimista)
  IF v_lote.version != p_version_esperada THEN
    RETURN QUERY SELECT FALSE, v_lote.version, v_lote.cantidad, 
      'Conflicto de versión: ' || v_lote.version || ' != ' || p_version_esperada;
    RETURN;
  END IF;
  
  -- Verificar disponibilidad
  IF v_lote.estado != 1 THEN
    RETURN QUERY SELECT FALSE, v_lote.version, v_lote.cantidad, 
      'Lote no disponible (estado: ' || v_lote.estado || ')';
    RETURN;
  END IF;
  
  -- Verificar cantidad
  IF v_lote.cantidad < p_cantidad THEN
    RETURN QUERY SELECT FALSE, v_lote.version, v_lote.cantidad,
      'Stock insuficiente: ' || v_lote.cantidad || ' < ' || p_cantidad;
    RETURN;
  END IF;
  
  -- Verificar vencimiento
  IF v_lote.fecha_vencimiento < CURRENT_DATE THEN
    RETURN QUERY SELECT FALSE, v_lote.version, v_lote.cantidad, 'Lote vencido';
    RETURN;
  END IF;
  
  -- Actualizar cantidad y versión
  UPDATE pharma.lotes
  SET cantidad = cantidad - p_cantidad,
      estado = CASE WHEN (cantidad - p_cantidad) = 0 THEN 2 ELSE 1 END,
      version = version + 1,
      updated_at = now()
  WHERE id = p_lote_id;
  
  RETURN QUERY SELECT TRUE, v_lote.version + 1, v_lote.cantidad - p_cantidad, 'Reserva exitosa';
END;
$$ LANGUAGE plpgsql;

-- Índice para mejorar rendimiento en consultas concurrentes
CREATE INDEX idx_lotes_estado_cantidad ON pharma.lotes(estado, cantidad) WHERE cantidad > 0;

-- Configurar statement timeout para prevenir bloqueos largos (30 segundos)
ALTER DATABASE CURRENT SET statement_timeout = '30s';

-- Configurar deadlock timeout (1 segundo)
ALTER DATABASE CURRENT SET deadlock_timeout = '1s';

