import Redis from 'ioredis';

const SEED = [
    { id: 1, name: 'Chanel No. 5', brand: 'Chanel', price: 129990, category: 'femenino', stock: 15 },
    { id: 2, name: 'Dior Sauvage', brand: 'Dior', price: 99990, category: 'masculino', stock: 20 }
];

const ITEMS_KEY = 'perfumes:items';
const COUNTER_KEY = 'perfumes:nextId';

export class RedisStore {
    constructor(url) {
        this.redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
    }

    async close() {
        await this.redis.quit();
    }

    async init() {
        await this.redis.connect();
        const exists = await this.redis.exists(ITEMS_KEY);
        if (!exists) {
            const pipeline = this.redis.pipeline();
            for (const item of SEED) {
                pipeline.hset(ITEMS_KEY, item.id, JSON.stringify(item));
            }
            pipeline.set(COUNTER_KEY, 2);
            await pipeline.exec();
        }
    }

    async all() {
        const data = await this.redis.hgetall(ITEMS_KEY);
        return Object.values(data).map(value => JSON.parse(value));
    }

    async getById(id) {
        const value = await this.redis.hget(ITEMS_KEY, id);
        return value ? JSON.parse(value) : undefined;
    }

    async create({ name, brand, price, category, stock }) {
        const id = await this.redis.incr(COUNTER_KEY);
        const newPerfume = {
            id,
            name,
            brand,
            price,
            category,
            stock: stock || 0
        };
        await this.redis.hset(ITEMS_KEY, id, JSON.stringify(newPerfume));
        return newPerfume;
    }
}

export { SEED };