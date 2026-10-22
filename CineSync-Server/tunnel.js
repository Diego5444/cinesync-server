/**
 * Túnel público: expone el servidor local en una URL pública https
 * que funciona desde cualquier lugar del mundo (sin configurar router).
 */
const localtunnel = require("localtunnel");
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    const tunnel = await localtunnel({ port: PORT, subdomain: "cinesync-api" });
    console.log("=".repeat(60));
    console.log("  TUNEL PÚBLICO ACTIVO");
    console.log("");
    console.log("  URL pública (comparte esta con tu hermano):");
    console.log(`  ${tunnel.url}`);
    console.log("");
    console.log("  Ejemplo de uso:");
    console.log(`  ${tunnel.url}/v1/catalog`);
    console.log("");
    console.log("  Para probar: abre en el navegador:");
    console.log(`  ${tunnel.url}/v1/health`);
    console.log("=".repeat(60));

    tunnel.on("close", () => {
      console.log("Túnel cerrado. Reinicia con: npm run tunnel");
    });

    // Mantener vivo
    setInterval(() => {}, 60000);
  } catch (err) {
    console.error("Error creando túnel:", err.message);
    console.log("Intenta de nuevo o usa: npx ngrok http " + PORT);
  }
})();
