import express from 'express';
import { getAllPerfumes, getPerfumeById, createPerfume } from './perfumes.js';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

// Estado del servicio (usado por Docker, Compose y el pipeline)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'perfume-catalog-api',
        version: process.env.APP_VERSION || 'dev'
    });
});

// Listar, filtrar, buscar y ordenar perfumes
app.get('/perfumes', async (req, res) => {
    const { category, sort, search } = req.query;
    let result = [...(await getAllPerfumes())];

    if (category && category.trim() !== '') {
        result = result.filter(p => p.category === category);
    }

    if (search && search.trim() !== '') {
        result = result.filter(p =>
            p.name.toLowerCase().includes(search.toLowerCase())
        );
    }

    if (sort === 'price_asc') {
        result.sort((a, b) => a.price - b.price);
    } else if (sort === 'price_desc') {
        result.sort((a, b) => b.price - a.price);
    }

    res.json(result);
});

// Buscar perfume por ID
app.get('/perfumes/:id', async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: 'Invalid ID format'
        });
    }

    const perfume = await getPerfumeById(id);

    if (!perfume) {
        return res.status(404).json({
            error: 'Perfume not found'
        });
    }

    res.json(perfume);
});

// Crear un perfume
app.post('/perfumes', async (req, res) => {
    const { name, brand, price, category, stock } = req.body;

    if (!name || !brand || price === undefined || price === null || !category) {
        return res.status(400).json({
            error: 'Missing required fields'
        });
    }

    if (price <= 0 || stock < 0) {
        return res.status(400).json({
            error: 'Invalid price or stock'
        });
    }

    const newPerfume = await createPerfume({
        name,
        brand,
        price,
        category,
        stock
    });

    res.status(201).json(newPerfume);
});

// Ruta raíz: información básica del servicio
app.get('/', (req, res) => {
    res.json({
        service: 'perfume-catalog-api',
        version: process.env.APP_VERSION || 'dev',
        endpoints: ['/health', '/perfumes', '/perfumes/:id']
    });
});

// Ruta no encontrada
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

export default app;
