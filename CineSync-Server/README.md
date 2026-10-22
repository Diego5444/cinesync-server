# CineSync API Server

Servidor que expone el catálogo de CineSync (películas, series, animes) como API REST con API keys.

## Configuración (una sola vez)

1. Instala las dependencias:
   ```
   npm install
   ```

2. Descarga tu clave de servicio de Firebase:
   - Firebase Console → tu proyecto (abby-cdb30) → Configuración del proyecto → Cuentas de servicio
   - Botón "Generar nueva clave privada"
   - Guarda el archivo como `serviceAccountKey.json` en esta carpeta

3. Arranca el servidor:
   ```
   node server.js
   ```

## Cómo funciona

- Lee el contenido de la misma base de datos que la app (Firebase RTDB)
- Expone endpoints REST con API keys
- Las keys se administran **desde la app** (Panel Admin → Servidor API)
- Generar o revocar una key surte efecto al instante (sin reiniciar)

## API Keys

Cada key tiene un tipo de acceso:

| Tipo | Qué permite |
|---|---|
| `full` | Acceso a todo (catálogo, streams, subtítulos, imágenes) |
| `streaming` | Catálogo + enlaces de reproducción |
| `subtitles` | Catálogo + enlaces de subtítulos |
| `basic` | Solo catálogo (títulos, sinopsis, posters) |

Las keys se generan desde la app y se guardan en `config/api_server/keys` en Firebase.

## Endpoints

Todos requieren autenticación:
```
Authorization: Bearer {tu_api_key}
```
o en la URL:
```
?api_key={tu_api_key}
```

| Endpoint | Descripción | Tipo de key |
|---|---|---|
| `GET /v1/health` | Estado del servidor | Ninguna (público) |
| `GET /v1/catalog` | Catálogo completo | Cualquiera |
| `GET /v1/catalog/movies` | Solo películas | Cualquiera |
| `GET /v1/catalog/series` | Solo series | Cualquiera |
| `GET /v1/catalog/anime` | Solo animes | Cualquiera |
| `GET /v1/content/:id` | Detalle de una obra | Cualquiera |
| `GET /v1/content/:id/stream` | Enlaces de reproducción | streaming o full |
| `GET /v1/content/:id/subtitles` | Enlaces de subtítulos | subtitles o full |
| `GET /v1/content/:id/images` | Posters/banners | Cualquiera |

## Acceso desde internet

Para que otras webs accedan desde cualquier lugar:

1. Encuentra tu IP pública: busca "mi IP" en Google
2. Abre el puerto 3000 en tu router (port forwarding)
3. La URL será: `http://TU_IP:3000/v1/...`

Opcionalmente, usa un servicio como ngrok para HTTPS:
```
npx ngrok http 3000
```

## Ejemplo de uso desde otra web (JavaScript)

```javascript
// Obtener el catálogo
const response = await fetch("http://TU_IP:3000/v1/catalog", {
  headers: { "Authorization": "Bearer cs_live_abc123..." }
});
const data = await response.json();
// data.content = [{ id, title, posterUrl, ... }, ...]

// Obtener enlaces de una película
const stream = await fetch("http://TU_IP:3000/v1/content/abc123/stream", {
  headers: { "Authorization": "Bearer cs_live_abc123..." }
});
const streamData = await stream.json();
// streamData.servers = [{ serverName, streamUrl }, ...]
```
