// Script de arranque: genera una key de prueba, arranca el servidor y muestra todo
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const KEYS_FILE = path.join(__dirname, "keys.json");

// Generar key inicial si no existe
if (!fs.existsSync(KEYS_FILE)) {
  const keys = { keys: [] };

  // Key para el hermano (acceso completo)
  const brotherKey = {
    id: "key_hermano",
    name: "Hermano - Bogotá",
    type: "full",
    key: "cs_live_" + crypto.randomBytes(24).toString("hex"),
    active: true,
    requests: 0,
    lastUsed: 0,
    createdAt: Date.now()
  };

  keys.keys.push(brotherKey);
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), "utf8");

  console.log("API Key generada para el hermano:");
  console.log("  " + brotherKey.key);
  console.log("");
}

// Mostrar las keys actuales
const data = JSON.parse(fs.readFileSync(KEYS_FILE, "utf8"));
console.log("Keys activas:");
data.keys.filter(k => k.active).forEach(k => {
  console.log(`  [${k.type}] ${k.name}: ${k.key.substring(0, 20)}...`);
});
console.log("");
console.log("Iniciando servidor...");
