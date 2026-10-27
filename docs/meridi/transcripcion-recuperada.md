# Meridi — transcripción recuperada (parcial)

Recuperada el 27 de octubre de 2026.
Conversación original: `6ae05ab0-d768-83ed-8380-08369907b1fe`.

La herramienta devolvió únicamente 5 intercambios recientes y no ofreció cursor de paginación. Este archivo conserva literalmente los mensajes devueltos; no contiene el historial anterior ni los documentos adjuntos. No debe presentarse como copia completa.

---

## Usuario

**no exigir instalar un conector para utilizar las APIs externas**.

Además, el servidor nunca debería aceptar URLs arbitrarias sin controles de seguridad: un endpoint personalizado malicioso podría utilizarse para intentar acceder a servicios internos del VPS. Tendremos que validar destinos y restringir las conexiones.
¿Quieres que A.C.M.E. funcione exclusivamente en tu servidor, con registro obligatorio para todos, o que también pueda instalarse en un servidor propio?  
va ser un proeycto abierto de github, cualquiera se lo va a poder descargar y jugar, ver como está ehchoy demás

## Asistente

¡Perfecto! Entonces esto cambia una decisión importante de la arquitectura de A.C.M.E.

**A.C.M.E. será un videojuego web de código abierto, publicado en GitHub, que cualquiera podrá descargar, instalar en su propio equipo o servidor, modificar y utilizar con el proveedor de IA que prefiera.**

Y mantendremos la posibilidad de ofrecer una instalación pública donde los jugadores se registren y jueguen sin tener que instalar el videojuego.

## 🏗️ Arquitectura definitiva que propongo

Tendremos **un único proyecto**, pero con dos formas de utilizarlo.

| Característica | Instalación pública | Instalación propia |
|---|---|---|
| Acceso | Navegador | Navegador |
| Instalación | Ninguna | Descargar desde GitHub |
| Registro | Obligatorio | Configurable |
| Base de datos | PostgreSQL | PostgreSQL o SQLite |
| IA | API elegida por el jugador | API u Ollama local |
| Guardado | Servidor público | Equipo o servidor propio |
| Código fuente | Abierto | Abierto |
| Personalización | Preferencias del jugador | Control total de la instalación |

### 1. Los jugadores podrán utilizar sus propios modelos

El sistema tendrá adaptadores para:

- [OpenAI](https://openai.com?utm_source=chatgpt.com)
- [Anthropic](https://www.anthropic.com?utm_source=chatgpt.com)
- [Google Gemini](https://ai.google.dev?utm_source=chatgpt.com)
- [Ollama](https://ollama.com?utm_source=chatgpt.com)
- [LM Studio](https://lmstudio.ai?utm_source=chatgpt.com)
- APIs compatibles con OpenAI.
- Endpoints personalizados mediante protocolos compatibles.

Por ejemplo, alguien podría descargarse A.C.M.E., ejecutarlo en su ordenador y conectarlo a Ollama sin utilizar ninguna API de pago.

Otra persona podría instalarlo en un VPS y utilizar Claude, GPT o Gemini.

**El juego no dependerá de una empresa concreta de inteligencia artificial.**

### 2. Instalación sencilla mediante Docker

Me gustaría que cualquier usuario pudiera levantar A.C.M.E. con un procedimiento muy sencillo.

Por ejemplo:

```bash
git clone <repositorio-de-acme>
cd acme
docker compose up -d
```

Esto es un objetivo de instalación; tendremos que preparar el repositorio, los archivos de configuración y las imágenes necesarias.

Para quienes quieran contribuir al desarrollo, también habrá instalación mediante Node.js y pnpm.

### 3. Seguridad y código abierto

Que el código sea abierto no significa que las claves API deban ser públicas.

Cada instalación tendrá su propia configuración y sus propios secretos.

En una instalación pública, las claves de los jugadores se almacenarán cifradas y el backend controlará las llamadas a los proveedores.

Los endpoints personalizados estarán sujetos a controles contra SSRF, especialmente para impedir que una URL suministrada por un jugador permita acceder a servicios internos del servidor.

En una instalación propia, el administrador podrá configurar sus proveedores y conexiones locales.

### 4. GitHub será el centro del desarrollo

Organizaría el repositorio así:

```text
acme/
├── apps/
│   ├── web/              # Videojuego web
│   └── server/           # API y motor del juego
│
├── packages/
│   ├── engine/           # Reglas deterministas
│   ├── case-schema/      # Estructura de investigaciones
│   ├── case-generator/   # Generación y validación con IA
│   ├── ai-adapters/      # Ollama, OpenAI, Anthropic...
│   └── shared/           # Tipos y utilidades comunes
│
├── docker/
├── docs/
├── tests/
├── docker-compose.yml
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

Además, incluiría documentación para que otros desarrolladores puedan crear nuevos proveedores de IA, mejorar el motor o contribuir con traducciones.

## ⚖️ Hay una decisión importante: la licencia

Si queremos que cualquiera pueda descargar, estudiar y modificar A.C.M.E., debemos escoger una licencia de software libre o código abierto.

Las dos que valoraría inicialmente son:

| Licencia | Características |
|---|---|
| **MIT** | Muy permisiva. Permite modificar, distribuir e incluso comercializar versiones derivadas sin obligación general de publicar sus modificaciones. |
| **AGPL-3.0** | Exige compartir el código fuente correspondiente de versiones modificadas que se ofrecen como servicio a través de una red, bajo las condiciones de la licencia. |

**Mi recomendación inicial sería AGPL-3.0**, si quieres que las mejoras de quienes modifiquen A.C.M.E. y lo ofrezcan públicamente como servicio también permanezcan abiertas.

MIT sería más adecuada si prefieres dar máxima libertad de reutilización, incluso para proyectos propietarios.

También conviene separar la licencia del código de las licencias de música, imágenes y otros recursos. Y, dado que nos inspiramos en *Carmen Sandiego*, deberíamos crear identidad, personajes, nombres y elementos gráficos originales para evitar problemas de propiedad intelectual. Podemos mantener la estética detectivesca retro sin copiar marcas ni personajes protegidos.

---

## 🎯 Lo que queda establecido

**A.C.M.E. será:**

- Un videojuego **100 % web**, sin PWA obligatoria.
- **Open source**, publicado en GitHub.
- **Autoalojable**, tanto en un ordenador como en un VPS.
- Con **registro de usuarios**, configurable en instalaciones privadas.
- Compatible con **modelos de IA locales y APIs externas**.
- Con un backend que controla las reglas, los expedientes y las partidas.
- Con posibilidad de ofrecer una **instalación pública** sin desarrollar otra versión del juego.

Esto también encaja muy bien con tu idea de desarrollar el proyecto mediante agentes de programación: podremos organizar las tareas, las pruebas y las contribuciones alrededor de un repositorio público.

**Solo quiero cerrar una decisión antes de actualizar el documento técnico: ¿prefieres MIT, para que cualquiera pueda hacer prácticamente lo que quiera con el código, o AGPL-3.0, para exigir que las modificaciones ofrecidas como servicio también se compartan?**

---

## Usuario

si, me ha gustado eso de docker o pnpm(pero este utimo no s si se necesita registraese dinero oalgo, por docker creo qeu iria bien).
en un princpio el proeycto lo voy a desarrollar en local con IA local, pero mas tarde lo pondre en produccion con un VPS y yo costeare las llamadas al endpoint con freellmapi en un principio, leugo ya ose lo qeu haré, epro ue cada pesona lo peuda resporudcir en su equipo y conu nednpoint peuda jugar, esa es la clave

## Asistente

Ahora sí, tenemos mucho más claro cómo debe funcionar A.C.M.E. Y hay una decisión importante: **debemos diseñarlo para que funcione de manera independiente, tanto en tu ordenador como en un servidor público, sin cambiar el código del juego.**

Además, tu planteamiento permite desarrollar y probar prácticamente todo sin gastar dinero en llamadas a APIs.

## 1. Primero, una aclaración: Docker y pnpm son gratuitos

No necesitas registrarte ni pagar para utilizar pnpm.

| Herramienta | ¿Gratuita? | ¿Para qué sirve? |
|---|---|---|
| **[pnpm](https://pnpm.io?utm_source=chatgpt.com)** | Sí | Instalar dependencias y ejecutar el proyecto durante el desarrollo. |
| **[Docker](https://www.docker.com?utm_source=chatgpt.com)** | Sí, bajo las condiciones de licencia aplicables | Ejecutar la aplicación y sus servicios en contenedores. |
| **[GitHub](https://github.com?utm_source=chatgpt.com)** | Tiene un plan gratuito | Publicar el código y gestionar contribuciones. |

Docker Desktop tiene condiciones específicas para determinadas organizaciones grandes, pero para tu desarrollo personal no debería suponer un coste de licencia.

**Mi recomendación es utilizar ambos, porque cumplen funciones distintas.**

- **pnpm:** para desarrollar y ejecutar pruebas.
- **Docker Compose:** para instalar A.C.M.E. fácilmente, tanto en local como en un VPS.

Quien quiera jugar no tendrá que instalar pnpm si utiliza Docker.

---

## 2. Las tres etapas de A.C.M.E.

Esta sería nuestra estrategia.

### 🟢 ETAPA 1 — Desarrollo local

**Tu ordenador será el entorno de desarrollo completo.**

```text
       TU ORDENADOR
  ┌───────────────────────────┐
  │                           │
  │  A.C.M.E. WEB             │
  │  React + TypeScript       │
  │           │               │
  │           ▼               │
  │  BACKEND A.C.M.E.         │
  │  Motor + expedientes      │
  │           │               │
  │           ▼               │
  │  OLLAMA / LM STUDIO       │
  │  RTX 5080                 │
  │                           │
  │  Base de datos local      │
  └───────────────────────────┘
```

Aquí podremos desarrollar el motor, generar investigaciones, conversar con personajes y comprobar las mecánicas utilizando modelos locales.

No necesitaremos contratar un servidor ni consumir tokens de pago.

**Importante:** Ollama se ejecutará inicialmente en tu sistema operativo, fuera de Docker. El backend de A.C.M.E. se conectará a él mediante una dirección configurable. Así evitamos complicar el desarrollo con contenedores GPU desde el principio.

### 🟡 ETAPA 2 — Publicación en GitHub

Cuando tengamos una versión jugable, publicaremos el repositorio con documentación y Docker Compose.

Cualquier persona podrá:

1. Descargar el proyecto.
2. Configurar su proveedor de IA.
3. Ejecutar A.C.M.E. con Docker.
4. Abrir el juego en su navegador.
5. Crear su detective y comenzar a investigar.

Si tiene Ollama, podrá utilizarlo. Si prefiere una API externa, introducirá sus credenciales.

**No necesitará conectarse a tu servidor ni consumir tus tokens.**

Esto es fundamental para que el proyecto sea verdaderamente independiente.

### 🔵 ETAPA 3 — Tu servidor público

Cuando decidas poner A.C.M.E. en producción, lo desplegaremos en tu VPS.

```text
              INTERNET
                 │
                 ▼
       ┌────────────────────┐
       │   A.C.M.E. WEB     │
       │ Registro / Login   │
       └─────────┬──────────┘
                 │
                 ▼
       ┌────────────────────┐
       │    TU VPS          │
       │                    │
       │ Motor del juego    │
       │ Generador de casos │
       │ Base de datos      │
       │ Usuarios y partidas│
       └─────────┬──────────┘
                 │
                 ▼
       ┌────────────────────┐
       │    FreeLLMAPI      │
       │                    │
       │ Tu clave API       │
       │ Tu consumo         │
       └────────────────────┘
```

Aquí introduces una diferencia respecto a lo que habíamos planteado inicialmente:

**Los jugadores de tu instalación pública no tendrán que aportar necesariamente su propia API.**

Tú proporcionarás el servicio de IA utilizando FreeLLMAPI, al menos inicialmente.

Esto permitirá que alguien entre en tu web, se registre y empiece a jugar sin configurar modelos ni endpoints.

## 3. Dos modalidades de inteligencia artificial

Creo que debemos formalizar dos modos.

| Característica | IA proporcionada por el servidor | IA propia del jugador |
|---|---|---|
| Configurar API | No | Sí |
| Quién paga las llamadas | Administrador | Jugador |
| Proveedor | Definido por administrador | Elegido por jugador |
| Ollama local | No necesariamente | Sí, en instalación propia |
| Generación de casos | Sí | Sí |
| Conversaciones | Sí | Sí |

**En tu VPS podrías habilitar únicamente la IA proporcionada por ti**, mientras que las instalaciones autoalojadas permitirían configurar libremente sus propios proveedores.

O podrías ofrecer ambas modalidades.

La configuración debe depender del administrador de cada instalación, no requerir modificaciones del código.

### ⚠️ Un detalle que no debemos pasar por alto

Si tú pagas las llamadas de todos los usuarios, necesitaremos controles de consumo.

Por ejemplo, límites de casos generados por usuario, peticiones por minuto, concurrencia y presupuestos máximos de tokens.

No significa que debamos imponer restricciones estrictas desde el principio, pero sí disponer de los mecanismos para evitar que un usuario o un proceso defectuoso agote tu presupuesto.

También deberíamos guardar métricas de consumo sin registrar innecesariamente las conversaciones privadas.

---

## 4. Cómo resolvería la configuración

Cada instalación tendría una configuración de servidor.

Por ejemplo:

```yaml
# Ejemplo conceptual, no configuración definitiva

acme:
  registration_enabled: true

  ai:
    mode: server_provided

    provider: freellmapi
    model: modelo-configurado

    allow_user_providers: false

  limits:
    daily_cases_per_user: 5
    requests_per_minute: 30
```

En tu ordenador utilizaríamos otra configuración:

```yaml
acme:
  registration_enabled: false

  ai:
    mode: user_configured

    provider: ollama
    endpoint: http://host.docker.internal:11434
```

La URL mostrada es orientativa para Docker Desktop; en Linux u otras configuraciones podría requerir ajustes.

Las claves API reales se gestionarían mediante secretos o variables de entorno, **nunca dentro de archivos públicos de GitHub**.

---

## 5. La arquitectura que elegiría

Con tus objetivos, me quedaría con:

| Componente | Tecnología |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + TypeScript |
| API | Fastify |
| Motor | TypeScript independiente |
| Base de datos | PostgreSQL |
| ORM | Drizzle |
| IA | Adaptadores por proveedor |
| Desarrollo | pnpm |
| Despliegue | Docker Compose |
| Repositorio | GitHub |
| Pruebas | Vitest + Playwright |

Utilizaría PostgreSQL también en desarrollo mediante Docker. Así reducimos las diferencias entre tu ordenador y el VPS.

No necesitamos microservicios ni Kubernetes. **Un backend modular y una base de datos son suficientes para empezar.**

---

## 6. Un principio fundamental del proyecto

Quiero destacar una regla que deberíamos incorporar al documento de arquitectura:

> **A.C.M.E. no dependerá de ningún servidor, proveedor de IA o servicio externo controlado por el creador del proyecto para poder funcionar en una instalación propia.**
>
> Cualquier persona podrá descargar el código, desplegarlo, configurar un modelo compatible y jugar de forma independiente.

Esto es exactamente lo que estás buscando.

También significa que, si algún día dejas de mantener tu VPS público, las instalaciones de otras personas podrán seguir funcionando.

---

## ¿Qué haría ahora?

Considero que **ya tenemos suficientes decisiones para cerrar la arquitectura general** y empezar a definir la estructura técnica del proyecto.

Pero antes hay un detalle que quiero resolver porque afecta a la experiencia del jugador:

**En tu instalación pública, cuando alguien se registre, ¿quieres que pueda jugar gratuitamente utilizando tu FreeLLMAPI sin configurar absolutamente nada?**

Entiendo que esa es tu intención. Si es así, diseñaremos A.C.M.E. para que la IA del servidor sea la opción predeterminada y la configuración de modelos propios sea una función adicional para quienes la necesiten.

---

## Usuario

quiero que sea AGPL-3.0, para exigir que las modificaciones ofrecidas como servicio también se compartan, o sea, codigo libre, que todo el mundo quiera hace lo que uiera con el, si lo mejora, qeu lo comaprta que lo pueda hace fork, y qu siempre en los crédits esté yo, por lo menos, que he sido el creador inicial d la obra

## Asistente

Perfecto. **Queda aprobada la licencia AGPL-3.0 para A.C.M.E.**, con una condición que para ti es especialmente importante: **que siempre se reconozca quién creó originalmente el proyecto**.

Y podemos organizarlo para que se cumpla lo que buscas.

## ⚖️ ¿Qué permitirá la licencia AGPL-3.0?

| Acción | ¿Permitida? |
|---|---|
| Descargar A.C.M.E. gratuitamente | ✅ |
| Estudiar todo su código | ✅ |
| Modificarlo como quieran | ✅ |
| Crear un fork en GitHub | ✅ |
| Añadir funcionalidades y mejorarlo | ✅ |
| Instalarlo en un ordenador o VPS propio | ✅ |
| Cobrar por una versión o servicio | ✅ |
| Distribuir una versión modificada como software propietario cerrado | ❌ |
| Ofrecer una versión modificada como servicio web sin facilitar su código a los usuarios | ❌ |
| Eliminar los avisos de autoría originales protegidos por la licencia | ❌ |

La AGPL-3.0 exige conservar los avisos de copyright y licencia, identificar modificaciones y facilitar el código fuente correspondiente cuando una versión modificada se ofrece a usuarios a través de una red. **No obliga a publicar todas las modificaciones privadas que alguien haga únicamente para sí mismo.** :chatgpt-content-reference{index="0"}

## 🏅 ¿Cómo garantizamos que aparezcas como creador?

Aquí distinguiría dos cosas.

**1. Reconocimiento legal de autoría.** La AGPL-3.0 ya exige conservar los avisos de copyright correspondientes.

**2. Reconocimiento visible dentro del videojuego.** Podemos reforzarlo mediante los avisos de autoría admitidos por la sección 7(b) de la licencia, que permite exigir la conservación de atribuciones razonables en determinadas condiciones. No significa que podamos imponer cualquier obligación sobre todos los créditos de cualquier obra derivada. :chatgpt-content-reference{index="1"}

Mi propuesta sería incorporar desde el primer día:

- **`LICENSE`**: texto íntegro de la AGPL-3.0.
- **`NOTICE.md`**: identificación del proyecto y de su creador original.
- **`AUTHORS.md`**: creador original y colaboradores posteriores.
- **`CONTRIBUTING.md`**: normas para colaborar y presentar mejoras.
- **Pantalla «Acerca de / Créditos»**: autoría original, colaboradores, licencia y acceso al código fuente.

Además, estableceríamos una política de contribuciones que permita reconocer a quienes mejoren el proyecto sin borrar la atribución original.

### Ejemplo de los créditos

La pantalla del juego podría mostrar:

**A.C.M.E. — Juego de investigación internacional**

**Creado originalmente por Antonio Moles**  
Proyecto iniciado en 2026.

Desarrollado como proyecto de código abierto con la colaboración de la comunidad.

Licencia: GNU Affero General Public License v3.0.

*El nombre del autor lo confirmaremos antes de publicar los avisos legales definitivos.*

---

## 🔓 Una cuestión que considero importante

Quiero que tengas clara una diferencia:

**La AGPL-3.0 protege la libertad del código, pero no garantiza que todas las mejoras regresen a tu repositorio original.**

Por ejemplo, alguien puede hacer un fork, mejorarlo, publicarlo bajo AGPL-3.0 y mantener su propio repositorio sin enviarte una solicitud de incorporación.

Eso es completamente válido.

Lo que sí exige la licencia, cuando corresponde, es que el código de esas modificaciones esté disponible bajo sus condiciones.

Y eso encaja con tu objetivo: que cualquiera pueda mejorar A.C.M.E. y que esas mejoras sigan siendo accesibles para la comunidad.

## 📌 Decisión incorporada al proyecto

| Elemento | Decisión |
|---|---|
| Licencia | **AGPL-3.0** |
| Código fuente | Público en GitHub |
| Forks | Permitidos |
| Modificaciones | Permitidas |
| Uso comercial | Permitido |
| Versiones modificadas ofrecidas como servicio | Código fuente disponible conforme a AGPL |
| Autoría original | Conservada en avisos legales y créditos según las condiciones aplicables |
| Colaboraciones | Abiertas a la comunidad |
| Instalación propia | Permitida |
| Dependencia de tu VPS | Ninguna |

**Mi recomendación es utilizar `AGPL-3.0-only`**, en lugar de permitir automáticamente versiones futuras de la licencia. Así mantenemos las condiciones de esta versión concreta.

Y una precaución: antes de publicar, convendrá revisar la redacción exacta de la atribución adicional con alguien especializado en licencias de software libre, para asegurarnos de que sea válida y compatible con la AGPL.

### Una última cosa

Ahora tenemos una identidad bastante definida para el proyecto:

**Un videojuego detectivesco internacional, generado mediante IA, gratuito y de código abierto, que cualquiera puede instalar, modificar y mejorar, respetando la autoría original.**

Eso es lo que vamos a construir.

El siguiente paso será actualizar nuestro documento de arquitectura para reflejar todas las decisiones que hemos cerrado: **web, backend, Docker, IA local o externa, despliegue público, autoalojamiento y AGPL-3.0**.

---

## Usuario

ok, y sobr esto..En tu instalación pública, cuando alguien se registre, ¿quieres que pueda jugar gratuitamente utilizando tu FreeLLMAPI sin configurar absolutamente nada?  

sí

## Asistente

Perfecto. **Queda aprobada otra decisión fundamental para A.C.M.E.: en la instalación pública, cualquier usuario podrá registrarse y jugar gratuitamente sin configurar ninguna IA.**

El funcionamiento será el siguiente:

1. **El jugador entra en A.C.M.E.** y crea una cuenta con usuario y contraseña.
2. **Accede directamente al juego**, crea su detective y comienza una investigación.
3. **A.C.M.E. utiliza automáticamente FreeLLMAPI**, con la API configurada por ti en el servidor.
4. **Tú asumes el consumo de IA** de esa instalación pública, inicialmente.
5. **El jugador no necesita conocimientos técnicos**, instalar programas ni introducir claves API.

### Dos formas de disfrutar A.C.M.E.

| | Servidor público | Instalación propia |
|---|---|---|
| Precio para jugar | Gratis | Gratis |
| Registro | Obligatorio | Configurable |
| Instalación | Ninguna | Docker |
| IA predeterminada | FreeLLMAPI, proporcionada por ti | La que configure el usuario |
| Claves API | No necesarias para el jugador | Propias |
| Ollama local | No necesario | Compatible |
| Guardado | Tu VPS | Su propia instalación |
| Código fuente | AGPL-3.0 | AGPL-3.0 |

### Una protección imprescindible para tu VPS

Como vas a pagar las llamadas a FreeLLMAPI, incorporaremos desde el principio un **sistema de control de consumo**, aunque inicialmente los límites sean generosos.

Tendrá registro de consumo por usuario, límites configurables, protección contra solicitudes abusivas y un límite global de gasto o uso para evitar sorpresas.

También diseñaremos el sistema para que, si en el futuro decides cambiar FreeLLMAPI por otro proveedor, puedas hacerlo desde la configuración del servidor **sin modificar el código del videojuego**.

---

## 🏗️ Ya podemos cerrar la arquitectura general

Tenemos definidos los principios principales:

**A.C.M.E. será un videojuego web gratuito, de código abierto bajo AGPL-3.0, con reconocimiento de su creador original, instalación mediante Docker, backend propio y compatibilidad con modelos locales y APIs externas.**

Tu instalación pública ofrecerá IA gratuitamente a los jugadores. Quien descargue el proyecto desde GitHub podrá ejecutarlo de forma independiente utilizando su propio modelo o endpoint.

**El siguiente paso que te propongo es preparar el Documento de Arquitectura Técnica (TAD v1.0)**, complementario al GDD que ya aprobamos.

Ese documento definirá los componentes, la base de datos, los contratos entre el motor y la IA, la seguridad, la estructura del repositorio, Docker y el plan de desarrollo por fases.

Así tendremos los dos documentos de referencia antes de comenzar a programar.

---

## Usuario

ok, procede

## Asistente

¡Perfecto! Ya he preparado el **Documento de Arquitectura Técnica de A.C.M.E. (TAD v1.0)**, tomando como referencia el GDD que aprobamos y todas las decisiones posteriores.

## 📘 Documento de Arquitectura Técnica

**:chatgpt-content-reference{index="0"}[📥 Descargar A.C.M.E. — TAD v1.0 (Word)](sandbox:/mnt/data/ACME_TAD_v1.0_revision.docx)**

El documento contiene **19 apartados** y establece cómo vamos a construir el videojuego.

### ¿Qué hemos definido?

| Área | Decisión |
|---|---|
| Plataforma | Videojuego web |
| Código | Abierto, licencia AGPL-3.0 |
| Desarrollo | Local, con Ollama y tu RTX 5080 |
| Herramientas | Docker Compose y pnpm |
| Frontend | React + TypeScript |
| Backend | Node.js + Fastify |
| Base de datos | PostgreSQL |
| IA | Modelos locales, APIs externas y endpoints compatibles |
| Instalación pública | VPS con registro de usuarios |
| IA pública | FreeLLMAPI, inicialmente a tu cargo |
| Distribución | GitHub, instalación independiente mediante Docker |
| Desarrollo asistido | Arquitecto de software y agentes especializados |

### 🔐 También hemos contemplado la seguridad

El documento incluye la protección de claves API, el control de consumo para que nadie agote tus recursos, la prevención de conexiones maliciosas y la separación entre el motor del juego y la IA.

### 🧠 Lo más importante: el motor de investigación

He mantenido como requisito fundamental que **la IA nunca pueda modificar los hechos establecidos de una investigación**.

El motor controlará las pruebas, los personajes, el tiempo, las órdenes de detención y los resultados. La IA se encargará de interpretar las acciones del jugador y ofrecer conversaciones naturales.

También he definido cómo deberán generarse, validarse y simularse las investigaciones antes de permitir jugarlas.

---

## 🚀 ¿Qué viene después?

Con el GDD y el TAD tenemos las dos referencias principales del proyecto.

Mi propuesta es que **el siguiente paso sea preparar el repositorio y el entorno de desarrollo**, pero todavía sin implementar funcionalidades del videojuego.

Primero estableceríamos la estructura de carpetas, Docker, pnpm, las pruebas automáticas y las instrucciones para los agentes de programación.

Después comenzaríamos con el motor de investigación.

**Revisa el TAD y, si estás conforme, lo daremos por aprobado como base técnica de A.C.M.E.**


