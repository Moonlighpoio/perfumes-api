import request from 'supertest';
import app from '../src/index.js';
import { getPerfumeById, createPerfume } from '../src/perfumes.js';

describe('EP2 DevOps - Pruebas automatizadas Perfumes API', () => {
  describe('Health check', () => {
    test('GET /health responde 200 y el servicio está ok', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('perfume-catalog-api');
      expect(res.body.version).toBe('dev');
    });

    test('GET /health expone la versión configurada por variable de entorno', async () => {
      process.env.APP_VERSION = '2.0.0';
      const res = await request(app).get('/health');
      delete process.env.APP_VERSION;

      expect(res.status).toBe(200);
      expect(res.body.version).toBe('2.0.0');
    });

    test('No expone la cabecera X-Powered-By', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('GET /perfumes', () => {
    test('devuelve el catálogo completo', async () => {
      const res = await request(app).get('/perfumes');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('price');
    });

    test('filtra por categoría', async () => {
      const res = await request(app)
        .get('/perfumes')
        .query({ category: 'masculino' });

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.every(p => p.category === 'masculino')).toBe(true);
    });

    test('ignora categorías vacías', async () => {
      const res = await request(app)
        .get('/perfumes')
        .query({ category: '   ' });

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    test('busca por nombre sin distinguir mayúsculas', async () => {
      const res = await request(app)
        .get('/perfumes')
        .query({ search: 'dior' });

      expect(res.status).toBe(200);
      expect(res.body.some(p => p.name.includes('Dior'))).toBe(true);
    });

    test('ignora búsquedas vacías', async () => {
      const res = await request(app)
        .get('/perfumes')
        .query({ search: '   ' });

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    test('ordena por precio ascendente', async () => {
      const res = await request(app)
        .get('/perfumes')
        .query({ sort: 'price_asc' });

      expect(res.status).toBe(200);

      const prices = res.body.map(p => p.price);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    });

    test('ordena por precio descendente', async () => {
      const res = await request(app)
        .get('/perfumes')
        .query({ sort: 'price_desc' });

      expect(res.status).toBe(200);

      const prices = res.body.map(p => p.price);
      expect(prices).toEqual([...prices].sort((a, b) => b - a));
    });

    test('ignora un criterio de orden desconocido', async () => {
      const res = await request(app)
        .get('/perfumes')
        .query({ sort: 'nombre' });

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    test('combina filtro, búsqueda y orden', async () => {
      const res = await request(app)
        .get('/perfumes')
        .query({ category: 'femenino', search: 'chanel', sort: 'price_asc' });

      expect(res.status).toBe(200);
      expect(res.body.every(p => p.category === 'femenino')).toBe(true);
      expect(res.body.some(p => p.name.toLowerCase().includes('chanel'))).toBe(true);
    });
  });

  describe('GET /perfumes/:id', () => {
    test('obtiene un perfume existente', async () => {
      const res = await request(app).get('/perfumes/1');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
    });

    test('rechaza un ID no numérico', async () => {
      const res = await request(app).get('/perfumes/abc');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid ID format');
    });

    test('rechaza un ID decimal', async () => {
      const res = await request(app).get('/perfumes/1.5');

      expect(res.status).toBe(400);
    });

    test('rechaza un ID igual a cero', async () => {
      const res = await request(app).get('/perfumes/0');

      expect(res.status).toBe(400);
    });

    test('devuelve 404 si el perfume no existe', async () => {
      const res = await request(app).get('/perfumes/99999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Perfume not found');
    });
  });

  describe('POST /perfumes', () => {
    const validPerfume = {
      name: 'Perfume EP2',
      brand: 'Marca EP2',
      price: 25000,
      category: 'unisex',
      stock: 10
    };

    test.each(['name', 'brand', 'price', 'category'])(
      'rechaza la petición si falta el campo %s',
      async (field) => {
        const payload = { ...validPerfume };
        delete payload[field];

        const res = await request(app)
          .post('/perfumes')
          .send(payload);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Missing required fields');
      }
    );

    test('rechaza precio igual a cero', async () => {
      const res = await request(app)
        .post('/perfumes')
        .send({ ...validPerfume, price: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid price or stock');
    });

    test('rechaza precio negativo', async () => {
      const res = await request(app)
        .post('/perfumes')
        .send({ ...validPerfume, price: -100 });

      expect(res.status).toBe(400);
    });

    test('rechaza stock negativo', async () => {
      const res = await request(app)
        .post('/perfumes')
        .send({ ...validPerfume, stock: -1 });

      expect(res.status).toBe(400);
    });

    test('crea un perfume válido con stock', async () => {
      const res = await request(app)
        .post('/perfumes')
        .send(validPerfume);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Perfume EP2');
      expect(res.body.id).toBeDefined();
      expect(res.body.stock).toBe(10);
    });

    test('crea un perfume válido sin stock y asigna cero', async () => {
      const payload = { ...validPerfume };
      delete payload.stock;

      const res = await request(app)
        .post('/perfumes')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.stock).toBe(0);
    });
  });

  describe('Rutas no encontradas', () => {
    test('devuelve 404 en una ruta desconocida', async () => {
      const res = await request(app).get('/no-existe');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });
  });

  describe('Capa de datos', () => {
    test('getPerfumeById obtiene un perfume existente', () => {
      const perfume = getPerfumeById(1);

      expect(perfume).toBeDefined();
      expect(perfume.id).toBe(1);
    });

    test('getPerfumeById devuelve undefined si no existe', () => {
      expect(getPerfumeById(99999)).toBeUndefined();
    });

    test('createPerfume asigna ID y stock predeterminado', () => {
      const perfume = createPerfume({
        name: 'Perfume unitario',
        brand: 'Marca prueba',
        price: 15000,
        category: 'unisex'
      });

      expect(perfume.id).toBeDefined();
      expect(perfume.stock).toBe(0);
    });
  });
});
