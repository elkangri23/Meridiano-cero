#!/usr/bin/env python3
"""Genera el mapa versionado de la reescritura de conocimientos con contenido
real (tercera vuelta, 2026-11-07) a partir del volcado de producción.

Los `old` se leen del volcado `scripts/cases-prod-2026-11-07.json` (nunca se
escriben a mano, para que la guarda `current == old` del script de aplicación
no falle por un error de transcripción). Los `new` están redactados a mano
aquí, uno por uno, anclados al mundo de cada caso (evidencias, lugares,
personas, briefing, etiquetas de mecánica): 1-2 frases en primera persona,
sin inventar hechos (sin fechas, rutas ni cantidades: no existen en estos
mundos), sin referenciar la evidencia EV-11 (recuperación) y sin revelar la
solución (solo hechos del expediente).

Salida: `scripts/knowledge-content-rewrite-2026-11-07.json`.
"""
import json

NEW = {
    "generado-1589b7bf": {
        "acceso-archivos": "El acceso a los archivos está controlado por credenciales y horarios: la oficina de coordinación registra cada acceso reciente a los archivos.",
        "agenda-eventos": "Coordino la agenda de eventos institucionales en Bilbao, y la oficina de coordinación es el espacio de gestión de eventos con acceso a los archivos.",
        "auditoria": "La auditoría revisa la integridad de los registros: el análisis del cuaderno reveló una alteración en el registro de auditoría.",
        "auditoria-archivos": "Se prepara una auditoría sobre el estado de los archivos: el registro de archivos muestra una consulta fuera de horario y el análisis del cuaderno reveló una alteración en el registro de auditoría.",
        "camaras-seguridad": "Las cámaras de seguridad registran los movimientos en las instalaciones: las cámaras registran un traslado discreto hacia el archivo central.",
        "catalogo-archivos": "Gestiono el catálogo de archivos: un testigo describe la consulta de un catálogo antes de la auditoría, y con el catálogo localizo documentos y consultas.",
        "horarios-turno": "Controlo los horarios de los turnos de vigilancia: el registro de accesos vincula la tarjeta con un turno nocturno.",
        "maletin-documentos": "La ficha de préstamo indica la salida temporal de un maletín con documentos, y la solicitud de documentos confirma la reserva de ese maletín.",
        "registro-accesos": "Llevo el registro de accesos: el registro de accesos vincula la tarjeta con un turno nocturno, y ahí quedan las entradas y salidas del personal.",
        "registro-comprometedor": "Existe un registro comprometedor vinculado a los archivos del Meridiano-cero: el análisis del cuaderno revela una alteración en el registro de auditoría.",
        "solicitud-documentos": "Gestiono las solicitudes de documentos: la solicitud de documentos confirma la reserva de un maletín, y quedan registradas en el sistema.",
        "testigo-desaparicion": "Un testigo describe la consulta de un catálogo antes de la auditoría, y aporta datos sobre la desaparición vinculada a los archivos.",
    },
    "generado-1dfd99b9": {
        "avistamiento-carlos": "Vi a Carlos en Bilbao, en la oficina donde se revisaron los documentos laborales, antes de su desaparición.",
        "avistamiento-malaga": "Vi a Carlos en Málaga, en la biblioteca de Málaga, y recuerdo detalles de su comportamiento.",
        "barcelona": "Conozco Barcelona: el archivo de Barcelona guarda los registros y movimientos del cuaderno, y Sofía observó allí los movimientos relacionados con el cuaderno.",
        "bilbao": "Conozco Bilbao: la oficina de Marcos en Bilbao es donde se revisaron los documentos laborales, y el registro laboral de Bilbao es el primer registro del caso.",
        "comportamiento": "Recuerdo detalles del comportamiento de Carlos en Málaga: lo vi en la biblioteca de Málaga, lugar de consulta y testimonios.",
        "cuaderno-barcelona": "Sé que el cuaderno estuvo en Barcelona: el archivo de Barcelona guarda los registros y movimientos del cuaderno.",
        "cuaderno-campo": "Mi cuaderno de campo es el objeto del caso: el archivo de Barcelona guarda los registros y movimientos del cuaderno.",
        "movimientos": "Observé movimientos relacionados con el cuaderno en Barcelona: el archivo de Barcelona guarda los registros y movimientos del cuaderno.",
        "notas-privadas": "Me preocupaba que ciertas notas privadas del cuaderno se hicieran públicas: son notas del cuaderno de campo, y el archivo de Barcelona guarda los registros y movimientos del cuaderno.",
        "relacion-laboral": "Conozco la relación laboral que tenía con Carlos: en la oficina de Marcos en Bilbao se revisaron los documentos laborales.",
    },
    "generado-21d02570": {
        "acceso-interno": "Conozco los accesos internos y los permisos del personal autorizado: el registro de acceso muestra movimientos en el archivo durante el periodo investigado, y el testimonio de la guardia describe un acceso no habitual al edificio.",
        "fondo-falso": "Conozco los compartimentos ocultos y los fondos falsos: el análisis de la caja revela indicios de manipulación interna, y la caja de transporte estaba vacía junto al espacio del manuscrito.",
        "horario": "Controlo los horarios de acceso y vigilancia: el registro de acceso muestra movimientos en el archivo durante el periodo investigado, y el registro de seguridad asocia la etiqueta con un envío reciente.",
        "inventario": "Gestiono los inventarios y el control de las piezas documentadas: el inventario del taller indica una pieza histórica pendiente de catalogación, y en el archivo se observa que el manuscrito no está en su ubicación habitual.",
        "mercado-negro": "Conozco el mercado de antigüedades y los canales de venta: la documentación comercial relaciona el envío con una transacción de antigüedades, y el registro de seguridad asocia la etiqueta de envío con un envío reciente.",
        "movimiento-objeto": "Conozco los traslados y movimientos de objetos valiosos: se encontró una etiqueta de envío vinculada al traslado de material, el registro de seguridad la asocia con un envío reciente, y la caja de transporte estaba vacía junto al espacio del manuscrito.",
        "registro-acceso": "Llevo los registros de entrada y salida del edificio: el registro de acceso muestra movimientos en el archivo durante el periodo investigado.",
        "restauracion": "Conozco las técnicas y los procesos de restauración de piezas históricas: trabajo en el taller de restauración, donde el inventario del taller indica una pieza histórica pendiente de catalogación.",
    },
    "generado-25b39aed": {
        "articulo-mercado": "Conozco un artículo sobre el mercado de antigüedades: el análisis de las notas revela coincidencias con documentos de venta de antigüedades, y el registro de la galería muestra una transacción vinculada al manuscrito.",
        "fuente-anonima": "Tengo una fuente anónima sobre el caso: la comunicación entre coleccionistas aporta contexto sobre la rivalidad, y un testigo describe movimientos de documentos en la galería.",
        "horario-acceso": "Conozco los horarios de acceso al archivo: el horario de acceso coincide con los movimientos registrados, y el registro de préstamos muestra el movimiento de documentos en la biblioteca.",
        "manuscrito-meridiano": "Conozco el manuscrito y su valor histórico: se encuentra una carpeta con notas sobre el manuscrito del Meridiano-cero, y la factura de transporte indica el traslado del manuscrito entre ciudades.",
        "pista-bilbao": "Conozco una pista relacionada con Bilbao: se observa un registro de acceso al archivo con la firma del investigador desaparecido, y el archivo municipal de Bilbao es donde se consultan los registros del caso.",
        "registro-biblioteca": "Conozco los registros de la biblioteca: el registro de préstamos muestra el movimiento de documentos en la biblioteca, y un sobre con sello de biblioteca contiene referencias al manuscrito.",
        "registro-venta": "Conozco los registros de venta relacionados con el manuscrito: el registro de la galería muestra una transacción vinculada al manuscrito, y el análisis de las notas revela coincidencias con documentos de venta de antigüedades.",
        "rivalidad-coleccionistas": "Conozco la rivalidad entre coleccionistas: la comunicación entre coleccionistas aporta contexto sobre la rivalidad, y el registro de la galería muestra una transacción vinculada al manuscrito.",
    },
    "generado-4242ea44": {
        "acceso-registros": "Reviso los registros de acceso: el registro de accesos de Málaga muestra una entrada relevante, y el registro de la biblioteca muestra un acceso relevante para la investigación.",
        "consultoria-externa": "Reviso los procesos de la empresa como consultora externa: los documentos de consultoría de Barcelona contienen referencias a procesos internos.",
        "horario-biblioteca": "Recuerdo movimientos extraños en un horario concreto: un testigo describe un movimiento extraño observado en la biblioteca, y se observa un movimiento inusual entre los libros de la biblioteca de Bilbao.",
        "libro-oculto": "Recuerdo que un libro de la biblioteca se usó para ocultar un objeto: se localiza un objeto oculto en un libro de la biblioteca de Bilbao.",
        "pendrive-biblioteca": "Sé que un pendrive quedó oculto en un libro de la biblioteca de Bilbao: el análisis del objeto revela datos vinculados a los planos del proyecto Meridiano-cero.",
        "planos-meridiano": "Conozco los planos del proyecto Meridiano-cero: son información confidencial de la empresa, y el análisis del objeto revela datos vinculados a los planos del proyecto.",
        "registro-acceso": "Puedo consultar el registro de acceso: el registro de accesos de Málaga muestra una entrada relevante, y la recepción de Málaga tiene registro de visitas, paquetes y accesos.",
        "visitas-malaga": "Gestiono las visitas y los paquetes en la recepción de Málaga: el registro de Málaga anota una visita vinculada al caso, y el registro de accesos de Málaga muestra una entrada relevante.",
    },
    "generado-48a17a5b": {
        "acceso-planos": "Conozco el acceso a los planos confidenciales del proyecto: el archivo confidencial custodia planos y registros del proyecto, y el registro del archivo confirma la consulta de documentos técnicos.",
        "dispositivos": "Puedo revisar los dispositivos detectados por seguridad: el registro de seguridad resume los dispositivos detectados, y en el archivo se encuentra un dispositivo de almacenamiento.",
        "empresa-rival": "Conozco el interés de una empresa rival en los documentos: el registro técnico vincula el dispositivo con una extracción no autorizada, y el análisis confirma que la memoria USB contiene planos confidenciales.",
        "logs-seguridad": "Puedo revisar los registros de seguridad de los sistemas: el registro de seguridad resume los dispositivos detectados, y el registro de accesos muestra movimientos recientes en la oficina.",
        "memoria-usb": "Conozco el dispositivo que se usó para extraer los planos: se localiza un informe que contiene una memoria USB oculta, y el análisis confirma que la memoria USB contiene planos confidenciales.",
        "registro-accesos": "Controlo la entrada y salida de la oficina: llevo el registro de accesos, que muestra movimientos recientes en la oficina, y el registro de recepción muestra visitas vinculadas a la oficina.",
        "revision-documentos": "Revisé los documentos del proyecto como consultor externo: el registro del archivo confirma la consulta de documentos técnicos, y se observa un puesto de trabajo con acceso a documentación técnica protegida.",
        "visitas": "Controlo las visitas registradas durante el periodo investigado: el registro de recepción muestra visitas vinculadas a la oficina, y un testigo describe quién entró y salió durante el periodo investigado.",
    },
    "generado-4b7a3c11": {
        "archivo-bilbao": "Trabajo en el archivo de Bilbao y sé que allí se custodian los documentos y registros de la investigación: el registro de Bilbao confirma que el cuaderno estuvo en el archivo antes de su desaparición.",
        "cuaderno-campo": "Conozco el cuaderno de campo y las notas de la jornada de trabajo: el registro de Bilbao confirma que el cuaderno estuvo en el archivo antes de su desaparición, y el análisis del estuche revela marcas compatibles con el material de trabajo de Elena Vargas.",
        "jornada-trabajo": "Mi jornada de trabajo tuvo lugar en Bilbao: en el archivo de Bilbao se observa una mesa de trabajo con documentos de la jornada de Elena Vargas.",
        "notas-arqueologicas": "Conozco las notas arqueológicas: el estuche de campo tiene restos de notas arqueológicas, y el registro de préstamos vincula un documento consultado con las notas del cuaderno.",
        "registro-prestamos": "Puedo consultar el registro de préstamos: el registro de préstamos vincula un documento consultado con las notas del cuaderno, y ahí quedan las consultas y los movimientos de archivos.",
        "viaje-malaga": "Conozco el desplazamiento hacia Málaga relacionado con el caso: el registro del almacén indica un envío recibido desde Barcelona, y el registro de movimientos conecta el envío con la documentación consultada en Barcelona.",
        "visitantes": "Puedo revisar los registros de visitantes: un bibliotecario declara haber visto a un colega de Elena revisar documentos en Barcelona, y la biblioteca de Barcelona tiene registros de visitantes y préstamos.",
    },
    "generado-71f0f281": {
        "asesoria-legal": "Sé que la asesoría legal revisó la documentación y detectó inconsistencias: en la oficina de Bilbao se observan carpetas contables con anotaciones inconsistentes, y el análisis del cuaderno revela alteraciones en cifras y firmas.",
        "cuenta-personal": "En los registros bancarios que llevo hay transferencias a una cuenta personal: el registro bancario muestra transferencias a una cuenta personal, y el extracto de cuenta tiene movimientos repetidos.",
        "cuentas-sospechosas": "He visto operaciones sospechosas en las cuentas de la empresa: el testimonio habla de movimientos extraños en las cuentas de la empresa, y el extracto de cuenta tiene movimientos repetidos.",
        "desvio-fondos": "Sé que los fondos se desviaron mediante documentos alterados: el análisis del cuaderno revela alteraciones en cifras y firmas, y hay una carpeta de documentos alterados localizada en el archivo de Málaga.",
        "documentos-alterados": "Vi que los documentos del archivo tenían modificaciones no autorizadas: hay una carpeta de documentos alterados localizada en el archivo de Málaga, y el informe interno habla de irregularidades detectadas en Málaga.",
        "documentos-falsificados": "Sé que los documentos contables presentan alteraciones y firmas inconsistentes: el análisis del cuaderno revela alteraciones en cifras y firmas, y el acta de revisión es de documentos contables de la sucursal.",
        "firma-similar": "Mi firma se confundió con la del responsable del fraude: el análisis del cuaderno revela alteraciones en cifras y firmas, y en la oficina se observan carpetas contables con anotaciones inconsistentes.",
        "irregularidades-malaga": "Vi irregularidades en los documentos contables en Málaga: el informe interno habla de irregularidades detectadas en Málaga, y hay una carpeta de documentos alterados localizada en el archivo de Málaga.",
        "movimientos-bilbao": "Noté movimientos extraños en las cuentas en Bilbao: el testimonio habla de movimientos extraños en las cuentas de la empresa, y en la oficina de Bilbao se observan carpetas contables con anotaciones inconsistentes.",
    },
    "generado-8621c8a9": {
        "acceso-despacho": "Controlo los accesos al despacho del Dr. Vela: el registro de entrada del edificio recoge los accesos del día de la desaparición, y el listado de salidas coincide con el horario del registro.",
        "consulta-registros": "Puedo consultar los registros de la biblioteca: la ficha de consulta de la biblioteca tiene fecha y nombre del solicitante, y el registro interno de depósito vincula el documento con una reserva académica.",
        "despacho-bilbao": "Sé que el despacho del Dr. Vela en Bilbao fue el punto de partida de la desaparición: el despacho aparece ordenado pero sin el manuscrito, y el registro de entrada recoge los accesos del día de la desaparición.",
        "documento-malaga": "Conozco el documento custodiado en Málaga: una funda protectora con un documento antiguo se localizó en una estantería reservada de la biblioteca de Málaga.",
        "manuscrito-malaga": "Sé que el manuscrito quedó vinculado a un depósito en Málaga: el registro interno de depósito vincula el documento con una reserva académica, y una funda protectora con un documento antiguo se localizó en una estantería reservada.",
        "manuscrito-restauracion": "Sé que el manuscrito estaba en proceso de restauración cuando desapareció: el despacho del Dr. Vela tiene mesa de restauración y estanterías de documentos, y la caja de restauración tiene etiqueta de envío y restos de papel antiguo.",
        "presion-vela": "Sé que el Dr. Vela recibió presiones para trasladarse a Barcelona: la correspondencia académica habla de la publicación de hallazgos del manuscrito, y el archivo académico guarda registros de publicaciones y correspondencia académica.",
        "publicacion-academica": "Me interesaba publicar hallazgos académicos relacionados con el manuscrito: la correspondencia académica habla de la publicación de hallazgos del manuscrito.",
        "registro-entrada": "Llevo el registro de entrada: el registro de entrada del edificio recoge los accesos del día de la desaparición, y el listado de salidas coincide con el horario del registro.",
    },
    "generado-9c165dae": {
        "acceso-restauracion": "Conozco los procedimientos que controlan el acceso a la sala de restauración: la sala de restauración muestra un acceso reciente y ordenado, y el archivo de restauración es la sala donde se custodian y tratan piezas del Meridiano-cero.",
        "agenda-visitas": "Gestiono las citas y los accesos con la agenda de recepción: la agenda de visitas tiene citas y accesos, y el informe de recepción tiene entregas registradas.",
        "entrega-maletin": "Tengo constancia de las entregas de maletines en recepción: el informe de recepción tiene entregas registradas, y la agenda de visitas tiene citas y accesos.",
        "mercado-arte": "Sigo el mercado de arte antiguo y sé que hay que verificar procedencia y valor: la factura de adquisición está vinculada al mercado de arte, y el certificado de procedencia es de documentos antiguos.",
        "movimiento-objeto": "Recuerdo los movimientos inusuales: los anoto en el cuaderno de vigilancia, que tiene anotaciones de movimientos, y hay un testimonio sobre movimientos inusuales en la instalación.",
        "procedencia-documentos": "Puedo hablar de la procedencia de los documentos antiguos: el certificado de procedencia es de documentos antiguos, y hay un registro mercantil de documentos antiguos en Barcelona.",
        "registro-entrada": "Registro las entradas y salidas en el sistema de vigilancia: el informe de recepción tiene entregas registradas, y el cuaderno de vigilancia tiene anotaciones de movimientos.",
        "traslado-bilbao": "Conozco los traslados de piezas hacia Bilbao que se registran en el archivo: hay una etiqueta de traslado vinculada a una pieza del archivo, y el análisis de la etiqueta revela manipulación reciente.",
    },
    "generado-f6559983": {
        "acceso-barcelona": "Sé que se detectaron accesos vinculados a la sede de Barcelona: el análisis del dispositivo auxiliar revela metadatos vinculados a Barcelona, y el registro final conecta la entrega con la documentación de Barcelona.",
        "acceso-bilbao": "Sé que se registraron accesos relevantes en la sede de Bilbao: se observa un acceso anómalo en la terminal de seguridad de Bilbao, y el registro de seguridad vincula la entrega con un acceso previo en Bilbao.",
        "alerta-filtracion": "Sé que la alerta de filtración inició la investigación del caso: el registro ampliado confirma la descarga de documentación confidencial, y el registro del archivo técnico muestra consultas a planos de infraestructura.",
        "auditoria-externa": "Sé que la auditoría externa revisó los controles de seguridad del proyecto: la oficina de seguridad es la sala de control y revisión de accesos del proyecto, y el registro de seguridad vincula la entrega con un acceso previo en Bilbao.",
        "dispositivo-cifrado": "Sé que el dispositivo cifrado contenía los datos confidenciales desaparecidos: el análisis del dispositivo auxiliar revela metadatos vinculados a Barcelona.",
        "entrega-dispositivo": "Tengo constancia de la entrega del dispositivo en recepción: un testimonio describe la entrega del dispositivo en Málaga, y el registro de recepción asocia la caja con una entrega reciente.",
        "logs-seguridad": "Reviso los logs de seguridad, que registran los eventos técnicos del sistema: se observa un acceso anómalo en la terminal de seguridad de Bilbao, y el registro de seguridad vincula la entrega con un acceso previo en Bilbao.",
        "planos-infraestructura": "Sé que los planos de infraestructura forman parte de la documentación confidencial filtrada: el registro del archivo técnico muestra consultas a planos de infraestructura, y el registro ampliado confirma la descarga de documentación confidencial.",
        "registro-accesos": "Llevo los registros de acceso: el registro de seguridad vincula la entrega con un acceso previo en Bilbao, y la recepción central es el punto de control de visitas y entregas en la sede de Málaga.",
    },
}

if __name__ == "__main__":
    with open("scripts/cases-prod-2026-11-07.json", encoding="utf-8") as fh:
        definitions = json.load(fh)
    cases = []
    total = 0
    for case_id in sorted(NEW):
        if case_id not in definitions:
            raise SystemExit(f"{case_id}: no está en el volcado de producción.")
        current = definitions[case_id]["texts"]["knowledge"]
        if set(current) != set(NEW[case_id]):
            raise SystemExit(
                f"{case_id}: las claves no coinciden (BD: {sorted(current)}, nuevas: {sorted(NEW[case_id])})."
            )
        knowledge = {}
        for key in sorted(NEW[case_id]):
            if "'" in NEW[case_id][key] or "\\" in NEW[case_id][key]:
                raise SystemExit(f"{case_id}/{key}: el texto nuevo lleva apóstrofo o barra.")
            knowledge[key] = {"old": current[key], "new": NEW[case_id][key]}
            total += 1
        cases.append({"case_id": case_id, "knowledge": knowledge})
    with open("scripts/knowledge-content-rewrite-2026-11-07.json", "w", encoding="utf-8") as fh:
        json.dump({"cases": cases}, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"Mapa generado: {len(cases)} casos, {total} textos.")
