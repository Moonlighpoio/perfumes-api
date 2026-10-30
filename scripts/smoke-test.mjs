#!/usr/bin/env node
/**
 * Smoke test del despliegue. Se ejecuta contra el gateway (Nginx) del
 * entorno levantado con Docker Compose, o contra cualquier URL mediante BASE_URL.
 */
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`ASSERT FAILED: ${message}`);
  }
};

const getJson = async (path, expectedStatus = 200) => {
  const res = await fetch(`${BASE_URL}${path}`, { signal: AbortSignal.timeout(10000) });
  const body = await res.json().catch(() => null);
  assert(res.status === expectedStatus, `${path} -> ${res.status} (esperado ${expectedStatus})`);
  return { res, body };
};

const main = async () => {
  // Espera activa: Compose puede tardar en levantar las réplicas.
  let healthy = false;
  for (let attempt = 1; attempt <= 30 && !healthy; attempt += 1) {
    try {
      const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
      healthy = res.ok;
    } catch {
      healthy = false;
    }
    if (!healthy) await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  assert(healthy, `el servicio no respondió en ${BASE_URL}/health`);

  const health = await getJson('/health');
  assert(health.body.status === 'ok', 'health.status debe ser ok');
  console.log('OK  GET /health');

  const all = await getJson('/perfumes');
  assert(Array.isArray(all.body) && all.body.length > 0, 'el catálogo debe ser un arreglo no vacío');
  console.log(`OK  GET /perfumes (${all.body.length} perfumes)`);

  const filtered = await getJson('/perfumes?category=masculino');
  assert(filtered.body.every((p) => p.category === 'masculino'), 'el filtro por categoría no se aplicó');
  console.log('OK  GET /perfumes?category=masculino');

  const searched = await getJson('/perfumes?search=dior');
  assert(searched.body.some((p) => p.name.toLowerCase().includes('dior')), 'la búsqueda por nombre no devolvió resultados');
  console.log('OK  GET /perfumes?search=dior');

  const sorted = await getJson('/perfumes?sort=price_asc');
  const prices = sorted.body.map((p) => p.price);
  assert(JSON.stringify(prices) === JSON.stringify([...prices].sort((a, b) => a - b)), 'el orden ascendente no es correcto');
  console.log('OK  GET /perfumes?sort=price_asc');

  const byId = await getJson('/perfumes/1');
  assert(byId.body.id === 1, 'GET /perfumes/1 no devolvió el perfume esperado');
  console.log('OK  GET /perfumes/1');

  const invalid = await getJson('/perfumes/abc', 400);
  assert(invalid.body.error === 'Invalid ID format', 'el ID inválido no devolvió 400');
  console.log('OK  GET /perfumes/abc -> 400');

  await getJson('/perfumes/99999', 404);
  console.log('OK  GET /perfumes/99999 -> 404');

  const missing = await getJson('/no-existe', 404);
  assert(missing.body.error === 'Not found', 'la ruta desconocida no devolvió 404');
  console.log('OK  GET /no-existe -> 404');

  const created = await fetch(`${BASE_URL}/perfumes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Perfume Smoke Test',
      brand: 'Equipo EP2',
      price: 19990,
      category: 'unisex',
      stock: 3
    }),
    signal: AbortSignal.timeout(10000)
  });
  assert(created.status === 201, `POST /perfumes -> ${created.status} (esperado 201)`);
  const createdBody = await created.json();
  assert(createdBody.id, 'el perfume creado no tiene id');
  console.log('OK  POST /perfumes -> 201');

  const response = await fetch(`${BASE_URL}/health`);
  assert(response.headers.get('x-content-type-options') === 'nosniff', 'faltan cabeceras de seguridad del gateway');
  console.log('OK  cabeceras de seguridad del gateway');

  console.log('\nSmoke test completado correctamente.');
};

main().catch((error) => {
  console.error(`\nSmoke test falló: ${error.message}`);
  process.exit(1);
});
