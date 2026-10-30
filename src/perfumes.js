const SEED = [
    { id: 1, name: 'Chanel No. 5', brand: 'Chanel', price: 129990, category: 'femenino', stock: 15 },
    { id: 2, name: 'Dior Sauvage', brand: 'Dior', price: 99990, category: 'masculino', stock: 20 }
];

export class MemoryStore {
    constructor() {
        this.items = SEED.map(item => ({ ...item }));
        this.nextId = 3;
    }

    async init() {}

    async close() {}

    async all() {
        return this.items.map(item => ({ ...item }));
    }

    async getById(id) {
        const item = this.items.find(perfume => perfume.id === id);
        return item ? { ...item } : undefined;
    }

    async create({ name, brand, price, category, stock }) {
        const newPerfume = {
            id: this.nextId++,
            name,
            brand,
            price,
            category,
            stock: stock || 0
        };
        this.items.push(newPerfume);
        return { ...newPerfume };
    }
}

let store = new MemoryStore();

/* istanbul ignore next */
if (process.env.REDIS_URL) {
    const { RedisStore } = await import('./redis-store.js');
    store = new RedisStore(process.env.REDIS_URL);
}

await store.init();

export async function getAllPerfumes() {
    return store.all();
}

export async function getPerfumeById(id) {
    return store.getById(id);
}

export async function createPerfume(data) {
    return store.create(data);
}

export async function closeStore() {
    await store.close();
}

export { SEED as perfumes };
export default { getAllPerfumes, getPerfumeById, createPerfume };