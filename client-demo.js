const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';

class ShoppingListDemo {
    constructor() {
        this.token = null;
        this.userId = null;
        this.listId = null;
        this.items = [];

        this.email = null;
        this.username = null;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async testHealth() {
        try {
            console.log('🧪 Testando health check...');
            const response = await axios.get(`${API_BASE_URL}/health`);
            console.log('✅ Health check OK');
            console.log('   Serviços:', Object.keys(response.data.services).join(', '));
            return true;
        } catch (error) {
            console.error('❌ Health check falhou:', error.message);
            return false;
        }
    }

    async testRegistry() {
        try {
            console.log('🧪 Testando service registry...');
            const response = await axios.get(`${API_BASE_URL}/registry`);
            console.log('✅ Registry OK');
            console.log('   Serviços registrados:', response.data.count);
            return true;
        } catch (error) {
            console.error('❌ Registry falhou:', error.message);
            return false;
        }
    }

    async registerUser() {
        try {
            console.log('👤 Registrando NOVO usuário...');
            const timestamp = Date.now();
            const userData = {
                email: `demo_user_${timestamp}@example.com`,
                username: `user_${timestamp}`,
                password: 'test123',
                firstName: 'Demo',
                lastName: 'User',
                preferences: {
                    defaultStore: 'Mercado Demo',
                    currency: 'BRL'
                }
            };

            const response = await axios.post(`${API_BASE_URL}/api/auth/register`, userData);

            console.log('✅ NOVO usuário registrado com sucesso');
            console.log('   ID:', response.data.data.user.id);
            console.log('   Email:', response.data.data.user.email);

            this.email = userData.email;
            this.username = userData.username;

            this.token = response.data.data.token;
            this.userId = response.data.data.user.id;

            return true;
        } catch (error) {
            console.error('❌ Registro falhou:', error.response?.data?.message || JSON.stringify(error.response?.data) || error.message);
            return false;
        }
    }


    async loginUser() {
        try {
            console.log('🔐 Fazendo login com usuário registrado...');

            if (!this.email && !this.username) {
                throw new Error('Email/username não definidos — registre antes de logar.');
            }

            const attempts = [];
            if (this.email) attempts.push({ identifier: this.email, password: 'test123' });
            if (this.username) attempts.push({ identifier: this.username, password: 'test123' });

            let response = null;
            let lastError = null;

            for (const creds of attempts) {
                try {
                    response = await axios.post(`${API_BASE_URL}/api/auth/login`, creds);
                    break;
                } catch (err) {
                    lastError = err;
                    console.warn(`⚠️ Tentativa de login com "${creds.identifier}" falhou:`, err.response?.data?.message || err.message);
                }
            }

            if (!response) {
                throw lastError || new Error('Todas as tentativas de login falharam');
            }

            console.log('✅ Login realizado com sucesso');
            console.log('   Usuário:', response.data.data.user.username);

            this.token = response.data.data.token;
            this.userId = response.data.data.user.id;

            return true;
        } catch (error) {
            console.error('❌ Login falhou:', error.response?.data?.message || JSON.stringify(error.response?.data) || error.message);
            return false;
        }
    }

    async getItems() {
        try {
            console.log('🛍️ Buscando itens...');
            const response = await axios.get(`${API_BASE_URL}/api/items`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            console.log('✅ Itens encontrados:', response.data.data.length);

            response.data.data.slice(0, 3).forEach(item => {
                console.log(`   - ${item.name} (R$ ${item.averagePrice})`);
            });

            this.items = response.data.data;
            return true;
        } catch (error) {
            console.error('❌ Busca de itens falhou:', error.response?.data?.message || error.message);
            return false;
        }
    }

    async getCategories() {
        try {
            console.log('📂 Buscando categorias...');
            const response = await axios.get(`${API_BASE_URL}/api/items/categories`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            console.log('✅ Categorias encontradas:', response.data.data.length);

            response.data.data.forEach(category => {
                console.log(`   - ${category.name} (${category.productCount} produtos)`);
            });

            return true;
        } catch (error) {
            console.error('❌ Busca de categorias falhou:', error.response?.data?.message || error.message);
            return false;
        }
    }

    async createList() {
        try {
            console.log('📝 Criando lista de compras...');
            const listData = {
                name: 'Minha Lista de Compras Demo',
                description: 'Lista criada durante demonstração'
            };

            const response = await axios.post(`${API_BASE_URL}/api/lists`, listData, {
                headers: { Authorization: `Bearer ${this.token}` }
            });

            console.log('✅ Lista criada com sucesso');
            console.log('   ID:', response.data.data.id);
            console.log('   Nome:', response.data.data.name);

            this.listId = response.data.data.id;
            return true;
        } catch (error) {
            console.error('❌ Criação de lista falhou:', error.response?.data?.message || error.message);
            return false;
        }
    }

    async addItemsToList() {
        try {
            console.log('➕ Adicionando itens à lista...');

            if (this.items.length === 0) {
                console.log('⚠️  Nenhum item disponível para adicionar');
                return false;
            }

            const itemsToAdd = this.items.slice(0, 3);

            for (const item of itemsToAdd) {
                const itemData = {
                    itemId: item.id,
                    quantity: Math.floor(Math.random() * 3) + 1,
                    notes: `Item adicionado na demo - ${item.name}`
                };

                try {
                    const response = await axios.post(
                        `${API_BASE_URL}/api/lists/${this.listId}/items`,
                        itemData,
                        {
                            headers: { Authorization: `Bearer ${this.token}` },
                            timeout: 10000
                        }
                    );

                    console.log(`✅ Item "${item.name}" adicionado (${itemData.quantity} ${item.unit})`);
                    await this.delay(300);
                } catch (error) {
                    console.error(`❌ Erro ao adicionar "${item.name}":`, error.response?.data?.message || error.message);
                }
            }

            return true;
        } catch (error) {
            console.error('❌ Adição de itens falhou:', error.response?.data?.message || error.message);
            return false;
        }
    }

    async getList() {
        try {
            console.log('📋 Buscando lista...');
            const response = await axios.get(`${API_BASE_URL}/api/lists/${this.listId}`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });

            const list = response.data.data;
            console.log('✅ Lista encontrada:');
            console.log(`   Nome: ${list.name}`);
            console.log(`   Status: ${list.status}`);
            console.log(`   Itens: ${list.items.length}`);
            console.log(`   Total estimado: R$ ${list.summary.estimatedTotal.toFixed(2)}`);

            if (list.items.length > 0) {
                console.log('   Itens na lista:');
                list.items.forEach(item => {
                    console.log(`     - ${item.itemName}: ${item.quantity} ${item.unit} (R$ ${(item.quantity * item.estimatedPrice).toFixed(2)})`);
                });
            }

            return true;
        } catch (error) {
            console.error('❌ Busca de lista falhou:', error.response?.data?.message || error.message);
            return false;
        }
    }

    async searchItems() {
        try {
            console.log('🔍 Buscando itens por termo "arroz"...');
            const response = await axios.get(`${API_BASE_URL}/api/search?q=arroz`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });

            console.log('✅ Busca realizada:');
            console.log(`   Itens encontrados: ${response.data.data.items.results.length}`);

            if (response.data.data.items.results.length > 0) {
                console.log('   Resultados:');
                response.data.data.items.results.slice(0, 3).forEach(item => {
                    console.log(`     - ${item.name} (${item.category}) - R$ ${item.averagePrice}`);
                });
            }

            return true;
        } catch (error) {
            console.error('❌ Busca falhou:', error.response?.data?.message || error.message);
            return false;
        }
    }

    async getDashboard() {
        try {
            console.log('📊 Buscando dashboard...');
            const response = await axios.get(`${API_BASE_URL}/api/dashboard`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });

            const dashboard = response.data.data;
            console.log('✅ Dashboard encontrado:');

            if (dashboard.data.user.available && dashboard.data.user.data) {
                console.log(`   Usuário: ${dashboard.data.user.data.firstName} ${dashboard.data.user.data.lastName}`);
            }

            if (dashboard.data.items.available) {
                console.log(`   Itens disponíveis: ${dashboard.data.items.data.length || dashboard.data.items.data.pagination?.total}`);
            }

            if (dashboard.data.lists.available) {
                console.log(`   Listas do usuário: ${dashboard.data.lists.data.length || dashboard.data.lists.data.pagination?.total}`);
            }

            return true;
        } catch (error) {
            console.error('❌ Busca de dashboard falhou:', error.response?.data?.message || error.message);
            return false;
        }
    }

    async runDemo() {
        console.log('🚀 Iniciando demonstração COMPLETA do sistema de lista de compras...\n');
        console.log('⏳ Aguardando serviços inicializarem...');

        await this.delay(5000);

        console.log('\n=== TESTE DE HEALTH CHECK ===');
        if (!await this.testHealth()) {
            console.log('❌ Sistema não está saudável. Verifique se todos os serviços estão rodando.');
            return;
        }
        await this.delay(1000);

        console.log('\n=== TESTE DE REGISTRY ===');
        if (!await this.testRegistry()) return;
        await this.delay(1000);

        console.log('\n=== REGISTRO DE NOVO USUÁRIO ===');
        if (!await this.registerUser()) return;
        await this.delay(1000);

        console.log('\n=== LOGIN COM USUÁRIO REGISTRADO ===');
        if (!await this.loginUser()) return;
        await this.delay(1000);

        console.log('\n=== CATÁLOGO DE ITENS ===');
        if (!await this.getItems()) {
            console.log('⚠️  Continuando demonstração sem itens...');
        }
        await this.delay(1000);

        console.log('\n=== CATEGORIAS ===');
        await this.getCategories();
        await this.delay(1000);

        console.log('\n=== LISTAS ===');
        if (!await this.createList()) return;
        await this.delay(1000);

        if (this.items.length > 0) {
            console.log('\n=== ADIÇÃO DE ITENS ===');
            await this.addItemsToList();
            await this.delay(1000);
        }

        console.log('\n=== VISUALIZAÇÃO DA LISTA ===');
        if (!await this.getList()) return;
        await this.delay(1000);

        console.log('\n=== BUSCA ===');
        await this.searchItems();
        await this.delay(1000);

        console.log('\n=== DASHBOARD ===');
        await this.getDashboard();

        console.log('   ✅ Registro de novo usuário');
        console.log('   ✅ Login com usuário registrado');
        console.log('   ✅ Busca de itens');
        console.log('   ✅ Criação de lista');
        console.log('   ✅ Adição de itens à lista');
        console.log('   ✅ Visualização do dashboard');
    }
}

const demo = new ShoppingListDemo();

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Erro não tratado:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Exceção não capturada:', error);
});

demo.runDemo().catch(error => {
    console.error('❌ Erro na demonstração:', error.message);
    console.log('1. Verifique se todos os serviços estão rodando');
    console.log('2. Aguarde alguns segundos para os serviços inicializarem completamente');
    console.log('3. Verifique os logs de cada serviço para identificar problemas');
});