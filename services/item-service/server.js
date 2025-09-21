const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const jwt = require('jsonwebtoken');

const JsonDatabase = require('../../shared/JsonDatabase');
const serviceRegistry = require('../../shared/serviceRegistry');

class ItemService {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3002;
        this.serviceName = 'item-service';
        this.serviceUrl = `http://localhost:${this.port}`;

        this.setupDatabase();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
        this.seedInitialData();
    }

    setupDatabase() {
        const dbPath = path.join(__dirname, 'database');
        this.itemsDb = new JsonDatabase(dbPath, 'items');
        this.categoriesDb = new JsonDatabase(dbPath, 'categories');
        console.log('Item Service: Banco NoSQL inicializado');
    }

    async seedInitialData() {
        setTimeout(async () => {
            try {
                const existingItems = await this.itemsDb.find();

                if (existingItems.length === 0) {
                    console.log('Criando dados iniciais para Item Service...');

                    const categories = [
                        { id: uuidv4(), name: 'Alimentos', slug: 'alimentos', description: 'Produtos alimentícios', productCount: 0 },
                        { id: uuidv4(), name: 'Limpeza', slug: 'limpeza', description: 'Produtos de limpeza', productCount: 0 },
                        { id: uuidv4(), name: 'Higiene', slug: 'higiene', description: 'Produtos de higiene pessoal', productCount: 0 },
                        { id: uuidv4(), name: 'Bebidas', slug: 'bebidas', description: 'Bebidas em geral', productCount: 0 },
                        { id: uuidv4(), name: 'Padaria', slug: 'padaria', description: 'Produtos de padaria', productCount: 0 }
                    ];

                    for (const category of categories) {
                        await this.categoriesDb.create(category);
                    }

                    const items = [
                        { id: uuidv4(), name: 'Arroz', category: 'Alimentos', brand: 'Tio João', unit: 'kg', averagePrice: 5.99, barcode: '1234567890123', description: 'Arroz branco tipo 1', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Feijão', category: 'Alimentos', brand: 'Camil', unit: 'kg', averagePrice: 8.49, barcode: '1234567890124', description: 'Feijão carioca', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Macarrão', category: 'Alimentos', brand: 'Renata', unit: 'un', averagePrice: 3.29, barcode: '1234567890125', description: 'Macarrão espaguete', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Óleo de Soja', category: 'Alimentos', brand: 'Liza', unit: 'litro', averagePrice: 7.99, barcode: '1234567890126', description: 'Óleo de soja refinado', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Açúcar', category: 'Alimentos', brand: 'União', unit: 'kg', averagePrice: 4.29, barcode: '1234567890127', description: 'Açúcar refinado', active: true, createdAt: new Date().toISOString() },

                        { id: uuidv4(), name: 'Detergente', category: 'Limpeza', brand: 'Ypê', unit: 'un', averagePrice: 2.49, barcode: '1234567890128', description: 'Detergente líquido', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Sabão em Pó', category: 'Limpeza', brand: 'Omo', unit: 'kg', averagePrice: 12.99, barcode: '1234567890129', description: 'Sabão em pó multiuso', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Desinfetante', category: 'Limpeza', brand: 'Veja', unit: 'litro', averagePrice: 6.99, barcode: '1234567890130', description: 'Desinfetante pinho', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Água Sanitária', category: 'Limpeza', brand: 'Qboa', unit: 'litro', averagePrice: 4.99, barcode: '1234567890131', description: 'Água sanitária', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Esponja', category: 'Limpeza', brand: 'Bombril', unit: 'un', averagePrice: 1.99, barcode: '1234567890132', description: 'Esponja de aço', active: true, createdAt: new Date().toISOString() },

                        { id: uuidv4(), name: 'Sabonete', category: 'Higiene', brand: 'Dove', unit: 'un', averagePrice: 2.99, barcode: '1234567890133', description: 'Sabonete hidratante', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Shampoo', category: 'Higiene', brand: 'Head & Shoulders', unit: 'un', averagePrice: 15.99, barcode: '1234567890134', description: 'Shampoo anticaspa', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Creme Dental', category: 'Higiene', brand: 'Colgate', unit: 'un', averagePrice: 4.49, barcode: '1234567890135', description: 'Creme dental total 12', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Papel Higiênico', category: 'Higiene', brand: 'Neve', unit: 'un', averagePrice: 8.99, barcode: '1234567890136', description: 'Papel higiênico 30m', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Fio Dental', category: 'Higiene', brand: 'Johnson & Johnson', unit: 'un', averagePrice: 5.99, barcode: '1234567890137', description: 'Fio dental mentolado', active: true, createdAt: new Date().toISOString() },

                        { id: uuidv4(), name: 'Refrigerante', category: 'Bebidas', brand: 'Coca-Cola', unit: 'litro', averagePrice: 7.99, barcode: '1234567890138', description: 'Refrigerante cola', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Suco', category: 'Bebidas', brand: 'Del Valle', unit: 'litro', averagePrice: 6.49, barcode: '1234567890139', description: 'Suco de laranja', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Água Mineral', category: 'Bebidas', brand: 'Crystal', unit: 'litro', averagePrice: 2.99, barcode: '1234567890140', description: 'Água mineral sem gás', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Café', category: 'Bebidas', brand: 'Melitta', unit: 'kg', averagePrice: 14.99, barcode: '1234567890141', description: 'Café torrado e moído', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Leite', category: 'Bebidas', brand: 'Itambé', unit: 'litro', averagePrice: 4.29, barcode: '1234567890142', description: 'Leite integral', active: true, createdAt: new Date().toISOString() },

                        { id: uuidv4(), name: 'Pão Francês', category: 'Padaria', brand: 'Padaria', unit: 'un', averagePrice: 0.50, barcode: '1234567890143', description: 'Pão francês unidade', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Bolo', category: 'Padaria', brand: 'Padaria', unit: 'kg', averagePrice: 19.99, barcode: '1234567890144', description: 'Bolo de chocolate', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Biscoito', category: 'Padaria', brand: 'Marilan', unit: 'un', averagePrice: 3.99, barcode: '1234567890145', description: 'Biscoito recheado', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Rosca Doce', category: 'Padaria', brand: 'Padaria', unit: 'un', averagePrice: 7.99, barcode: '1234567890146', description: 'Rosca doce com coco', active: true, createdAt: new Date().toISOString() },
                        { id: uuidv4(), name: 'Torta', category: 'Padaria', brand: 'Padaria', unit: 'kg', averagePrice: 24.99, barcode: '1234567890147', description: 'Torta de frango', active: true, createdAt: new Date().toISOString() }
                    ];

                    for (const item of items) {
                        await this.itemsDb.create(item);
                    }

                    console.log('Dados iniciais criados com sucesso!');
                }
            } catch (error) {
                console.error('Erro ao criar dados iniciais:', error);
            }
        }, 1000);
    }

    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(morgan('combined'));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        this.app.use((req, res, next) => {
            res.setHeader('X-Service', this.serviceName);
            res.setHeader('X-Service-Version', '1.0.0');
            res.setHeader('X-Database', 'JSON-NoSQL');
            next();
        });
    }

    setupRoutes() {
        this.app.get('/health', async (req, res) => {
            try {
                const itemCount = await this.itemsDb.count();
                const categoryCount = await this.categoriesDb.count();
                res.json({
                    service: this.serviceName,
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    version: '1.0.0',
                    database: {
                        type: 'JSON-NoSQL',
                        itemCount: itemCount,
                        categoryCount: categoryCount
                    }
                });
            } catch (error) {
                res.status(503).json({
                    service: this.serviceName,
                    status: 'unhealthy',
                    error: error.message
                });
            }
        });

        this.app.get('/', (req, res) => {
            res.json({
                service: 'Item Service',
                version: '1.0.0',
                description: 'Microsserviço para gerenciamento de itens com NoSQL',
                database: 'JSON-NoSQL',
                endpoints: [
                    'GET /items',
                    'GET /items/:id',
                    'POST /items',
                    'PUT /items/:id',
                    'GET /categories',
                    'GET /search'
                ]
            });
        });

        this.app.use(this.authMiddleware.bind(this));

        this.app.get('/items', this.getItems.bind(this));
        this.app.get('/items/:id', this.getItem.bind(this));
        this.app.post('/items', this.createItem.bind(this));
        this.app.put('/items/:id', this.updateItem.bind(this));

        this.app.get('/categories', this.getCategories.bind(this));

        this.app.get('/search', this.searchItems.bind(this));
    }

    setupErrorHandling() {
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                message: 'Endpoint não encontrado',
                service: this.serviceName
            });
        });

        this.app.use((error, req, res, next) => {
            console.error('Item Service Error:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do serviço',
                service: this.serviceName
            });
        });
    }

    async getItems(req, res) {
        try {
            const { category, name, page = 1, limit = 10 } = req.query;
            const skip = (page - 1) * parseInt(limit);

            const filter = { active: true };
            if (category) filter.category = category;
            if (name) filter.name = { $regex: name, $options: 'i' };

            const items = await this.itemsDb.find(filter, {
                skip: skip,
                limit: parseInt(limit),
                sort: { name: 1 }
            });

            const total = await this.itemsDb.count(filter);

            res.json({
                success: true,
                data: items,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });
        } catch (error) {
            console.error('Erro ao buscar itens:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    authMiddleware(req, res, next) {
        const authHeader = req.header('Authorization');

        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Token obrigatório'
            });
        }

        const token = authHeader.replace('Bearer ', '');

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'user-secret');
            req.user = decoded;
            next();
        } catch (error) {
            res.status(401).json({
                success: false,
                message: 'Token inválido'
            });
        }
    }

    async getItem(req, res) {
        try {
            const { id } = req.params;
            const item = await this.itemsDb.findById(id);

            if (!item || !item.active) {
                return res.status(404).json({
                    success: false,
                    message: 'Item não encontrado'
                });
            }

            res.json({
                success: true,
                data: item
            });
        } catch (error) {
            console.error('Erro ao buscar item:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async createItem(req, res) {
        try {
            const { name, category, brand, unit, averagePrice, barcode, description } = req.body;

            if (!name || !category || !unit || averagePrice === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Campos obrigatórios: name, category, unit, averagePrice'
                });
            }

            const existingItem = await this.itemsDb.findOne({
                name: { $regex: `^${name}$`, $options: 'i' },
                category: { $regex: `^${category}$`, $options: 'i' }
            });

            if (existingItem) {
                return res.status(409).json({
                    success: false,
                    message: 'Item já existe nesta categoria'
                });
            }

            const newItem = await this.itemsDb.create({
                id: uuidv4(),
                name,
                category,
                brand: brand || null,
                unit,
                averagePrice: parseFloat(averagePrice),
                barcode: barcode || null,
                description: description || null,
                active: true,
                createdAt: new Date().toISOString()
            });

            res.status(201).json({
                success: true,
                message: 'Item criado com sucesso',
                data: newItem
            });
        } catch (error) {
            console.error('Erro ao criar item:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async updateItem(req, res) {
        try {
            const { id } = req.params;
            const { name, category, brand, unit, averagePrice, barcode, description, active } = req.body;

            const item = await this.itemsDb.findById(id);
            if (!item) {
                return res.status(404).json({
                    success: false,
                    message: 'Item não encontrado'
                });
            }

            if (name && name !== item.name) {
                const existingItem = await this.itemsDb.findOne({
                    name: { $regex: `^${name}$`, $options: 'i' },
                    category: category || item.category
                });

                if (existingItem && existingItem.id !== id) {
                    return res.status(409).json({
                        success: false,
                        message: 'Já existe um item com este nome na categoria'
                    });
                }
            }

            const updates = {};
            if (name) updates.name = name;
            if (category) updates.category = category;
            if (brand !== undefined) updates.brand = brand;
            if (unit) updates.unit = unit;
            if (averagePrice !== undefined) updates.averagePrice = parseFloat(averagePrice);
            if (barcode !== undefined) updates.barcode = barcode;
            if (description !== undefined) updates.description = description;
            if (active !== undefined) updates.active = active;

            const updatedItem = await this.itemsDb.update(id, updates);

            res.json({
                success: true,
                message: 'Item atualizado com sucesso',
                data: updatedItem
            });
        } catch (error) {
            console.error('Erro ao atualizar item:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async getCategories(req, res) {
        try {
            const categories = await this.categoriesDb.find({}, { sort: { name: 1 } });

            for (const category of categories) {
                const itemCount = await this.itemsDb.count({
                    category: category.name,
                    active: true
                });
                category.productCount = itemCount;

                await this.categoriesDb.update(category.id, { productCount: itemCount });
            }

            res.json({
                success: true,
                data: categories
            });
        } catch (error) {
            console.error('Erro ao buscar categorias:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async searchItems(req, res) {
        try {
            const { q, limit = 10 } = req.query;

            if (!q) {
                return res.status(400).json({
                    success: false,
                    message: 'Parâmetro de busca "q" é obrigatório'
                });
            }

            const items = await this.itemsDb.search(q, ['name']);

            const activeItems = items
                .filter(item => item.active)
                .slice(0, parseInt(limit));

            res.json({
                success: true,
                data: {
                    query: q,
                    results: activeItems,
                    total: activeItems.length
                }
            });
        } catch (error) {
            console.error('Erro na busca de itens:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    registerWithRegistry() {
        serviceRegistry.register(this.serviceName, {
            url: this.serviceUrl,
            version: '1.0.0',
            database: 'JSON-NoSQL',
            endpoints: ['/health', '/items', '/items/:id', '/categories', '/search']
        });
    }
    startHealthReporting() {
        setInterval(() => {
            serviceRegistry.updateHealth(this.serviceName, true);
        }, 30000);
    }

    start() {
        this.app.listen(this.port, () => {
            console.log('=====================================');
            console.log(`Item Service iniciado na porta ${this.port}`);
            console.log(`URL: ${this.serviceUrl}`);
            console.log(`Health: ${this.serviceUrl}/health`);
            console.log(`Database: JSON-NoSQL`);
            console.log('=====================================');

            this.registerWithRegistry();
            this.startHealthReporting();
        });
    }
}

if (require.main === module) {
    const itemService = new ItemService();
    itemService.start();

    process.on('SIGTERM', () => {
        serviceRegistry.unregister('item-service');
        process.exit(0);
    });
    process.on('SIGINT', () => {
        serviceRegistry.unregister('item-service');
        process.exit(0);
    });
}

module.exports = ItemService;