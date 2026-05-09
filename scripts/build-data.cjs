/**
 * Orquestador del pipeline de datos del Dashboard Venado Tuerto.
 *
 * Uso: npm run build-data
 *
 * Corre, en orden:
 *   1. Los 8 análisis ejecutivos (uno por categoría).
 *   2. Los informes individuales por dataset (a medida que se vayan agregando).
 */

const path = require('path');

const PIPELINE = [
  // ── Análisis ejecutivos por categoría ──
  'process-cat-gobierno.cjs',
  'process-cat-hacienda-economia.cjs',
  'process-cat-educacion.cjs',
  'process-cat-salud-desarrollo-humano.cjs',
  'process-cat-seguridad-convivencia.cjs',
  'process-cat-obras-servicios.cjs',
  'process-cat-ambiente.cjs',
  'process-cat-vivienda-territorio.cjs',
  // ── Informes individuales por dataset ──
  // Gobierno
  'process-personal-municipal.cjs',
  'process-organigrama.cjs',
  'process-capacitaciones-rrhh.cjs',
  'process-documentacion-cdr.cjs',
  'process-comisiones-vecinales.cjs',
  'process-elecciones-vecinales.cjs',
  // ── Datos externos filtrados a Venado Tuerto ──
  'process-padron-educativo-vt.cjs',
  'process-censo-2022-vt.cjs',
];

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║       Dashboard Venado Tuerto — Build Data Pipeline      ║');
console.log('╚══════════════════════════════════════════════════════════╝');

const start = Date.now();
const failed = [];

for (const script of PIPELINE) {
  const scriptPath = path.join(__dirname, script);
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Running: ${script}`);
  console.log('─'.repeat(60));
  try {
    delete require.cache[require.resolve(scriptPath)];
    const fn = require(scriptPath);
    if (typeof fn === 'function') fn();
  } catch (err) {
    failed.push({ script, error: err.message });
    console.error(`  ❌ FAILED: ${script}\n     ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
  }
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\n${'═'.repeat(60)}`);
if (failed.length === 0) {
  console.log(`  ✅ ${PIPELINE.length} script(s) completados en ${elapsed}s`);
} else {
  console.log(`  ⚠ ${failed.length} de ${PIPELINE.length} script(s) fallaron — ${elapsed}s`);
  for (const f of failed) console.log(`     · ${f.script}: ${f.error}`);
  process.exitCode = 1;
}
console.log('═'.repeat(60));
