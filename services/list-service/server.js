const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const JsonDatabase = require('../../shared/JsonDatabase');
const serviceRegistry = require('../../shared/serviceRegistry');

class ListService {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3003;
        this.serviceName = 'list-service';
        this.serviceUrl = `http://localhost:${this.port}`;

        this.setupDatabase();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupDatabase() {
        const dbPath = path.join(__dirname, 'database');
        this.listsDb = new JsonDatabase(dbPath, 'lists');
        console.log('List Service: Banco NoSQL inicializado');
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
                const listCount = await this.listsDb.count();
                res.json({
                    service: this.serviceName,
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    version: '1.0.0',
                    database: {
                        type: 'JSON-NoSQL',
                        listCount: listCount
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
                service: 'List Service',
                version: '1.0.0',
                description: 'Microsserviço para gerenciamento de listas de compras com NoSQL',
                database: 'JSON-NoSQL',
                endpoints: [
                    'POST /lists',
                    'GET /lists',
                    'GET /lists/:id',
                    'PUT /lists/:id',
                    'DELETE /lists/:id',
                    'POST /lists/:id/items',
                    'PUT /lists/:id/items/:itemId',
                    'DELETE /lists/:id/items/:itemId',
                    'GET /lists/:id/summary'
                ]
            });
        });

        this.app.use(this.authMiddleware.bind(this));

        this.app.post('/lists', this.createList.bind(this));
        this.app.get('/lists', this.getLists.bind(this));
        this.app.get('/lists/:id', this.getList.bind(this));
        this.app.put('/lists/:id', this.updateList.bind(this));
        this.app.delete('/lists/:id', this.deleteList.bind(this));
        this.app.get('/search', this.searchLists.bind(this));

        this.app.post('/lists/:id/items', this.addItemToList.bind(this));
        this.app.put('/lists/:id/items/:itemId', this.updateItemInList.bind(this));
        this.app.delete('/lists/:id/items/:itemId', this.removeItemFromList.bind(this));

        this.app.get('/lists/:id/summary', this.getListSummary.bind(this));
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
            console.error('List Service Error:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do serviço',
                service: this.serviceName
            });
        });
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

    async createList(req, res) {
        try {
            const { name, description } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: 'Nome da lista é obrigatório'
                });
            }

            const newList = await this.listsDb.create({
                id: uuidv4(),
                userId: req.user.id,
                name,
                description: description || null,
                status: 'active',
                items: [],
                summary: {
                    totalItems: 0,
                    purchasedItems: 0,
                    estimatedTotal: 0
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            res.status(201).json({
                success: true,
                message: 'Lista criada com sucesso',
                data: newList
            });
        } catch (error) {
            console.error('Erro ao criar lista:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async getLists(req, res) {
        try {
            const { status, page = 1, limit = 10 } = req.query;
            const skip = (page - 1) * parseInt(limit);

            const filter = { userId: req.user.id };
            if (status) filter.status = status;

            const lists = await this.listsDb.find(filter, {
                skip: skip,
                limit: parseInt(limit),
                sort: { updatedAt: -1 }
            });

            const total = await this.listsDb.count(filter);

            res.json({
                success: true,
                data: lists,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });
        } catch (error) {
            console.error('Erro ao buscar listas:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async getList(req, res) {
        try {
            const { id } = req.params;
            const list = await this.listsDb.findById(id);

            if (!list) {
                return res.status(404).json({
                    success: false,
                    message: 'Lista não encontrada'
                });
            }

            if (list.userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            res.json({
                success: true,
                data: list
            });
        } catch (error) {
            console.error('Erro ao buscar lista:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async updateList(req, res) {
        try {
            const { id } = req.params;
            const { name, description, status } = req.body;

            const list = await this.listsDb.findById(id);
            if (!list) {
                return res.status(404).json({
                    success: false,
                    message: 'Lista não encontrada'
                });
            }

            if (list.userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            const updates = {
                updatedAt: new Date().toISOString()
            };
            if (name) updates.name = name;
            if (description !== undefined) updates.description = description;
            if (status) updates.status = status;

            const updatedList = await this.listsDb.update(id, updates);

            res.json({
                success: true,
                message: 'Lista atualizada com sucesso',
                data: updatedList
            });
        } catch (error) {
            console.error('Erro ao atualizar lista:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async deleteList(req, res) {
        try {
            const { id } = req.params;

            const list = await this.listsDb.findById(id);
            if (!list) {
                return res.status(404).json({
                    success: false,
                    message: 'Lista não encontrada'
                });
            }

            if (list.userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            await this.listsDb.delete(id);

            res.json({
                success: true,
                message: 'Lista deletada com sucesso'
            });
        } catch (error) {
            console.error('Erro ao deletar lista:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async searchLists(req, res) {
        try {
            const { q, limit = 10 } = req.query;
            console.log('🔍 Buscando listas por:', q);

            if (!q) {
                return res.status(400).json({
                    success: false,
                    message: 'Parâmetro de busca "q" é obrigatório'
                });
            }

            const allLists = await this.listsDb.find({ userId: req.user.id });
            console.log('📋 Total de listas do usuário:', allLists.length);

            const searchTerm = q.toLowerCase();
            const filteredLists = allLists.filter(list => {
                const matchesName = list.name && list.name.toLowerCase().includes(searchTerm);
                const matchesDesc = list.description && list.description.toLowerCase().includes(searchTerm);
                const matchesItems = list.items && list.items.some(item =>
                    item.itemName && item.itemName.toLowerCase().includes(searchTerm)
                );

                return matchesName || matchesDesc || matchesItems;
            });

            console.log('✅ Listas encontradas:', filteredLists.length);
            const limitedLists = filteredLists.slice(0, parseInt(limit));

            res.json({
                success: true,
                data: {
                    query: q,
                    results: limitedLists,
                    total: filteredLists.length
                }
            });
        } catch (error) {
            console.error('Erro na busca de listas:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async addItemToList(req, res) {
        try {
            const { id } = req.params;
            const { itemId, quantity, notes } = req.body;

            if (!itemId || !quantity) {
                return res.status(400).json({
                    success: false,
                    message: 'itemId e quantity são obrigatórios'
                });
            }

            const list = await this.listsDb.findById(id);
            if (!list) {
                return res.status(404).json({
                    success: false,
                    message: 'Lista não encontrada'
                });
            }

            if (list.userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            let itemInfo;
            try {
                const itemService = serviceRegistry.discover('item-service');

                const authHeader = req.header('Authorization');
                const token = authHeader.replace('Bearer ', '');

                const response = await axios.get(`${itemService.url}/items/${itemId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                itemInfo = response.data.data;

            } catch (error) {
                console.error('Erro ao buscar item:', error.message);
                console.error('Detalhes do erro:', error.response?.data);
                return res.status(404).json({
                    success: false,
                    message: 'Item não encontrado no catálogo'
                });
            }

            const existingItemIndex = list.items.findIndex(item => item.itemId === itemId);

            if (existingItemIndex !== -1) {
                list.items[existingItemIndex].quantity += parseFloat(quantity);
                list.items[existingItemIndex].updatedAt = new Date().toISOString();
                if (notes) list.items[existingItemIndex].notes = notes;
            } else {
                list.items.push({
                    itemId,
                    itemName: itemInfo.name,
                    quantity: parseFloat(quantity),
                    unit: itemInfo.unit,
                    estimatedPrice: itemInfo.averagePrice,
                    purchased: false,
                    notes: notes || null,
                    addedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }

            this.calculateListSummary(list);

            const updatedList = await this.listsDb.update(id, {
                items: list.items,
                summary: list.summary,
                updatedAt: new Date().toISOString()
            });

            res.status(201).json({
                success: true,
                message: 'Item adicionado à lista com sucesso',
                data: updatedList
            });
        } catch (error) {
            console.error('Erro ao adicionar item à lista:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async updateItemInList(req, res) {
        try {
            const { id, itemId } = req.params;
            const { quantity, purchased, notes } = req.body;

            const list = await this.listsDb.findById(id);
            if (!list) {
                return res.status(404).json({
                    success: false,
                    message: 'Lista não encontrada'
                });
            }

            if (list.userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            const itemIndex = list.items.findIndex(item => item.itemId === itemId);
            if (itemIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'Item não encontrado na lista'
                });
            }

            if (quantity !== undefined) list.items[itemIndex].quantity = parseFloat(quantity);
            if (purchased !== undefined) list.items[itemIndex].purchased = purchased;
            if (notes !== undefined) list.items[itemIndex].notes = notes;
            list.items[itemIndex].updatedAt = new Date().toISOString();

            this.calculateListSummary(list);

            const updatedList = await this.listsDb.update(id, {
                items: list.items,
                summary: list.summary,
                updatedAt: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Item atualizado com sucesso',
                data: updatedList
            });
        } catch (error) {
            console.error('Erro ao atualizar item na lista:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async removeItemFromList(req, res) {
        try {
            const { id, itemId } = req.params;

            const list = await this.listsDb.findById(id);
            if (!list) {
                return res.status(404).json({
                    success: false,
                    message: 'Lista não encontrada'
                });
            }

            if (list.userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            const filteredItems = list.items.filter(item => item.itemId !== itemId);

            if (filteredItems.length === list.items.length) {
                return res.status(404).json({
                    success: false,
                    message: 'Item não encontrado na lista'
                });
            }

            list.items = filteredItems;
            this.calculateListSummary(list);

            const updatedList = await this.listsDb.update(id, {
                items: list.items,
                summary: list.summary,
                updatedAt: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Item removido da lista com sucesso',
                data: updatedList
            });
        } catch (error) {
            console.error('Erro ao remover item da lista:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async getListSummary(req, res) {
        try {
            const { id } = req.params;

            const list = await this.listsDb.findById(id);
            if (!list) {
                return res.status(404).json({
                    success: false,
                    message: 'Lista não encontrada'
                });
            }

            if (list.userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            res.json({
                success: true,
                data: list.summary
            });
        } catch (error) {
            console.error('Erro ao buscar resumo da lista:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    calculateListSummary(list) {
        const summary = {
            totalItems: 0,
            purchasedItems: 0,
            estimatedTotal: 0
        };

        list.items.forEach(item => {
            summary.totalItems += item.quantity;
            if (item.purchased) {
                summary.purchasedItems += item.quantity;
            }
            summary.estimatedTotal += item.quantity * item.estimatedPrice;
        });

        list.summary = summary;
    }

    registerWithRegistry() {
        serviceRegistry.register(this.serviceName, {
            url: this.serviceUrl,
            version: '1.0.0',
            database: 'JSON-NoSQL',
            endpoints: ['/health', '/lists', '/lists/:id', '/lists/:id/items', '/lists/:id/summary', '/search']
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
            console.log(`List Service iniciado na porta ${this.port}`);
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
    const listService = new ListService();
    listService.start();

    process.on('SIGTERM', () => {
        serviceRegistry.unregister('list-service');
        process.exit(0);
    });
    process.on('SIGINT', () => {
        serviceRegistry.unregister('list-service');
        process.exit(0);
    });
}

module.exports = ListService;