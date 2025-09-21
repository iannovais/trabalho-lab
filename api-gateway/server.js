const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');
const path = require('path');

const serviceRegistry = require('../shared/serviceRegistry');

class APIGateway {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;

        this.circuitBreakers = new Map();

        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();

        setTimeout(() => {
            this.startHealthChecks();
        }, 3000);
    }

    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(morgan('combined'));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        this.app.use((req, res, next) => {
            res.setHeader('X-Gateway', 'api-gateway');
            res.setHeader('X-Gateway-Version', '1.0.0');
            res.setHeader('X-Architecture', 'Microservices-NoSQL');
            next();
        });

        this.app.use((req, res, next) => {
            console.log(`${req.method} ${req.originalUrl} - ${req.ip}`);
            next();
        });
    }

    setupRoutes() {
        this.app.get('/health', (req, res) => {
            const services = serviceRegistry.listServices();
            res.json({
                service: 'api-gateway',
                status: 'healthy',
                timestamp: new Date().toISOString(),
                architecture: 'Microservices with NoSQL',
                services: services,
                serviceCount: Object.keys(services).length
            });
        });

        this.app.get('/', (req, res) => {
            res.json({
                service: 'API Gateway',
                version: '1.0.0',
                description: 'Gateway para microsserviços de lista de compras',
                architecture: 'Microservices with NoSQL databases',
                database_approach: 'Database per Service (JSON-NoSQL)',
                endpoints: {
                    auth: '/api/auth/*',
                    users: '/api/users/*',
                    items: '/api/items/*',
                    lists: '/api/lists/*',
                    health: '/health',
                    registry: '/registry',
                    dashboard: '/api/dashboard',
                    search: '/api/search'
                },
                services: serviceRegistry.listServices()
            });
        });

        this.app.get('/registry', (req, res) => {
            const services = serviceRegistry.listServices();
            res.json({
                success: true,
                services: services,
                count: Object.keys(services).length,
                timestamp: new Date().toISOString()
            });
        });

        this.app.get('/debug/services', (req, res) => {
            serviceRegistry.debugListServices();
            res.json({
                success: true,
                services: serviceRegistry.listServices(),
                stats: serviceRegistry.getStats()
            });
        });

        this.app.use('/api/auth', (req, res, next) => {
            console.log(`🔗 Roteando para user-service: ${req.method} ${req.originalUrl}`);
            this.proxyRequest('user-service', req, res, next);
        });

        this.app.use('/api/users', (req, res, next) => {
            console.log(`🔗 Roteando para user-service: ${req.method} ${req.originalUrl}`);
            this.proxyRequest('user-service', req, res, next);
        });

        this.app.get('/api/search', this.globalSearch.bind(this));

        this.app.use('/api/items', (req, res, next) => {
            console.log(`🔗 Roteando para item-service: ${req.method} ${req.originalUrl}`);
            this.proxyRequest('item-service', req, res, next);
        });

        this.app.use('/api/lists', (req, res, next) => {
            console.log(`🔗 Roteando para list-service: ${req.method} ${req.originalUrl}`);
            this.proxyRequest('list-service', req, res, next);
        });

        this.app.get('/api/dashboard', this.getDashboard.bind(this));
    }

    setupErrorHandling() {
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                message: 'Endpoint não encontrado',
                service: 'api-gateway',
                availableEndpoints: {
                    auth: '/api/auth',
                    users: '/api/users',
                    items: '/api/items',
                    lists: '/api/lists',
                    dashboard: '/api/dashboard',
                    search: '/api/search'
                }
            });
        });

        this.app.use((error, req, res, next) => {
            console.error('Gateway Error:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do gateway',
                service: 'api-gateway'
            });
        });
    }

    async proxyRequest(serviceName, req, res, next) {
        try {
            console.log(`🔗 Proxy request: ${req.method} ${req.originalUrl} -> ${serviceName}`);

            if (this.isCircuitOpen(serviceName)) {
                console.log(`⚡ Circuit breaker open for ${serviceName}`);
                return res.status(503).json({
                    success: false,
                    message: `Serviço ${serviceName} temporariamente indisponível`,
                    service: serviceName
                });
            }

            let service;
            try {
                service = serviceRegistry.discover(serviceName);
            } catch (error) {
                console.error(`❌ Erro na descoberta do serviço ${serviceName}:`, error.message);
                const availableServices = serviceRegistry.listServices();
                console.log(`🔗 Serviços disponíveis:`, Object.keys(availableServices));

                return res.status(503).json({
                    success: false,
                    message: `Serviço ${serviceName} não encontrado`,
                    service: serviceName,
                    availableServices: Object.keys(availableServices)
                });
            }

            const originalPath = req.originalUrl;
            let targetPath = '';

            if (serviceName === 'user-service') {
                if (originalPath.startsWith('/api/auth')) {
                    targetPath = originalPath.replace('/api/auth', '/auth');
                } else {
                    targetPath = originalPath.replace('/api/users', '/users');
                }
            } else if (serviceName === 'item-service') {
                if (originalPath.startsWith('/api/items/search')) {
                    targetPath = '/search' + originalPath.slice('/api/items/search'.length);
                } else if (originalPath.startsWith('/api/items/categories')) {
                    targetPath = '/categories' + originalPath.slice('/api/items/categories'.length);
                } else {
                    targetPath = originalPath.replace('/api/items', '/items');
                }
            } else if (serviceName === 'list-service') {
                targetPath = originalPath.replace('/api/lists', '/lists');
            }

            if (targetPath === '/' || targetPath === '') {
                targetPath = '';
            }

            const targetUrl = `${service.url}${targetPath}`;
            console.log(`🔗 Target URL: ${targetUrl}`);

            const config = {
                method: req.method,
                url: targetUrl,
                headers: { ...req.headers },
                timeout: 10000,
                family: 4,
                validateStatus: function (status) {
                    return status < 500;
                }
            };

            if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
                config.data = req.body;
            }

            delete config.headers.host;
            delete config.headers['content-length'];

            console.log(`🔗 Enviando ${req.method} para ${targetUrl}`);

            const response = await axios(config);

            this.resetCircuitBreaker(serviceName);
            console.log(`🔗 Resposta recebida: ${response.status}`);

            res.status(response.status).json(response.data);

        } catch (error) {
            this.recordFailure(serviceName);
            console.error(`❌ Proxy error for ${serviceName}:`, {
                message: error.message,
                code: error.code,
                url: error.config?.url,
                status: error.response?.status
            });

            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                res.status(503).json({
                    success: false,
                    message: `Serviço ${serviceName} indisponível`,
                    service: serviceName,
                    error: error.code
                });
            } else if (error.response) {
                console.log(`🔗 Encaminhando erro ${error.response.status} do serviço`);
                res.status(error.response.status).json(error.response.data);
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Erro interno do gateway',
                    service: 'api-gateway',
                    error: error.message
                });
            }
        }
    }

    isCircuitOpen(serviceName) {
        const breaker = this.circuitBreakers.get(serviceName);
        if (!breaker) return false;

        const now = Date.now();
        if (breaker.isOpen && (now - breaker.lastFailure) > 30000) {
            breaker.isOpen = false;
            breaker.isHalfOpen = true;
            console.log(`Circuit breaker half-open for ${serviceName}`);
            return false;
        }

        return breaker.isOpen;
    }

    recordFailure(serviceName) {
        let breaker = this.circuitBreakers.get(serviceName) || {
            failures: 0,
            isOpen: false,
            isHalfOpen: false,
            lastFailure: null
        };

        breaker.failures++;
        breaker.lastFailure = Date.now();

        if (breaker.failures >= 3) {
            breaker.isOpen = true;
            breaker.isHalfOpen = false;
            console.log(`Circuit breaker opened for ${serviceName}`);
        }

        this.circuitBreakers.set(serviceName, breaker);
    }

    resetCircuitBreaker(serviceName) {
        const breaker = this.circuitBreakers.get(serviceName);
        if (breaker) {
            breaker.failures = 0;
            breaker.isOpen = false;
            breaker.isHalfOpen = false;
            console.log(`Circuit breaker reset for ${serviceName}`);
        }
    }

    async getDashboard(req, res) {
        try {
            const authHeader = req.header('Authorization');
            if (!authHeader) {
                return res.status(401).json({
                    success: false,
                    message: 'Token de autenticação obrigatório'
                });
            }

            let userId;
            try {
                const validateResponse = await axios.post('http://localhost:3001/auth/validate', {
                    token: authHeader.replace('Bearer ', '')
                });
                userId = validateResponse.data.data.user.id;
            } catch (error) {
                return res.status(401).json({
                    success: false,
                    message: 'Token inválido'
                });
            }

            const [userResponse, itemsResponse, listsResponse] = await Promise.allSettled([
                this.callService('user-service', `/users/${userId}`, 'GET', authHeader),
                this.callService('item-service', '/items', 'GET', authHeader, { limit: 5 }),
                this.callService('list-service', '/lists', 'GET', authHeader, { limit: 5 })
            ]);

            const dashboard = {
                timestamp: new Date().toISOString(),
                data: {
                    user: {
                        available: userResponse.status === 'fulfilled',
                        data: userResponse.status === 'fulfilled' ? userResponse.value.data : null,
                        error: userResponse.status === 'rejected' ? userResponse.reason.message : null
                    },
                    items: {
                        available: itemsResponse.status === 'fulfilled',
                        data: itemsResponse.status === 'fulfilled' ? itemsResponse.value.data : null,
                        error: itemsResponse.status === 'rejected' ? itemsResponse.reason.message : null
                    },
                    lists: {
                        available: listsResponse.status === 'fulfilled',
                        data: listsResponse.status === 'fulfilled' ? listsResponse.value.data : null,
                        error: listsResponse.status === 'rejected' ? listsResponse.reason.message : null
                    }
                }
            };

            res.json({
                success: true,
                data: dashboard
            });
        } catch (error) {
            console.error('Erro no dashboard:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao agregar dados do dashboard'
            });
        }
    }

    async globalSearch(req, res) {
        try {
            const { q } = req.query;
            if (!q) {
                return res.status(400).json({
                    success: false,
                    message: 'Parâmetro de busca "q" é obrigatório'
                });
            }

            const authHeader = req.header('Authorization');

            const searches = [
                this.callService('item-service', `/search?q=${encodeURIComponent(q)}`, 'GET', authHeader, {})
            ];

            if (authHeader) {
                searches.push(
                    this.callService('list-service', `/search?q=${encodeURIComponent(q)}`, 'GET', authHeader, { })
                );
            }

            const [itemResults, listResults] = await Promise.allSettled(searches);

            const results = {
                query: q,
                items: {
                    available: itemResults.status === 'fulfilled',
                    results: itemResults.status === 'fulfilled' ? itemResults.value.data.results : [],
                    error: itemResults.status === 'rejected' ? itemResults.reason.message : null
                }
            };

            if (listResults) {
                results.lists = {
                    available: listResults.status === 'fulfilled',
                    results: listResults.status === 'fulfilled' ? listResults.value.data.results || listResults.value.data : [],
                    error: listResults.status === 'rejected' ? listResults.reason.message : null
                };
            }

            res.json({
                success: true,
                data: results
            });
        } catch (error) {
            console.error('Erro na busca global:', error);
            res.status(500).json({
                success: false,
                message: 'Erro na busca'
            });
        }
    }

    async callService(serviceName, path, method = 'GET', authHeader = null, params = {}) {
        const service = serviceRegistry.discover(serviceName);
        const config = {
            method,
            url: `${service.url}${path}`,
            timeout: 5000
        };

        if (authHeader) {
            config.headers = { Authorization: authHeader };
        }

        if (method === 'GET' && Object.keys(params).length > 0) {
            config.params = params;
        }

        const response = await axios(config);
        return response.data;
    }

    startHealthChecks() {
        setInterval(async () => {
            await serviceRegistry.performHealthChecks();
        }, 30000);

        setTimeout(async () => {
            await serviceRegistry.performHealthChecks();
        }, 5000);
    }

    start() {
        this.app.listen(this.port, () => {
            console.log('=====================================');
            console.log(`API Gateway iniciado na porta ${this.port}`);
            console.log(`URL: http://localhost:${this.port}`);
            console.log(`Health: http://localhost:${this.port}/health`);
            console.log(`Registry: http://localhost:${this.port}/registry`);
            console.log(`Dashboard: http://localhost:${this.port}/api/dashboard`);
            console.log(`Architecture: Microservices with NoSQL`);
            console.log('=====================================');
            console.log('Rotas disponíveis:');
            console.log('  POST /api/auth/register');
            console.log('  POST /api/auth/login');
            console.log('  GET  /api/users/:id');
            console.log('  GET  /api/items');
            console.log('  GET  /api/lists');
            console.log('  GET  /api/search?q=termo');
            console.log('  GET  /api/dashboard');
            console.log('=====================================');
        });
    }
}

if (require.main === module) {
    const gateway = new APIGateway();
    gateway.start();

    process.on('SIGTERM', () => process.exit(0));
    process.on('SIGINT', () => process.exit(0));
}

module.exports = APIGateway;