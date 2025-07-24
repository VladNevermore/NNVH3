const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const crypto = require('crypto');

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}
const jwt = require('jsonwebtoken');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Подключение к MongoDB
mongoose.connect('mongodb://VladNevermore:123123123123@cluster0.2k2w9ao.mongodb.net:27017/nutterra?ssl=true&authSource=admin&retryWrites=true&w=majority', {
        serverSelectionTimeoutMS: 5000
    })
    .then(() => console.log('✅ Успешное подключение!'))
    .catch(err => console.error('❌ Ошибка:', err.message));

// Модели
const User = mongoose.model('User', {
    phone: String,
    name: String,
    password: String,
    cart: Array,
    orders: Array
});

const Product = mongoose.model('Product', {
    name: String,
    category: String,
    description: String,
    prices: Object, // { '100': 179, '200': 329, '400': 639 }
    images: Array,
    badges: Array // ['new', 'top', 'sale']
});

const Order = mongoose.model('Order', {
    userId: String,
    items: Array,
    total: Number,
    status: String,
    createdAt: Date
});

// Telegram бот для уведомлений
 const bot = new TelegramBot('Y7785677984:AAEfud9bqeMFXP8T7NBmvLYEqJhBzJ3ZVBI', { polling: true });
 const chatId = '351199882';

// API endpoints
app.post('/api/auth/register', async(req, res) => {
    try {
        const { phone, name } = req.body;

        // Проверка существующего пользователя
        const existingUser = await User.findOne({ phone });
        if (existingUser) {
            return res.status(400).json({ message: 'Пользователь уже существует' });
        }

        // Генерация кода (в реальном приложении отправить SMS)
        const code = Math.floor(1000 + Math.random() * 9000);

        // Сохраняем код во временное хранилище (в реальном приложении использовать Redis)
        // Здесь должен быть код для отправки SMS

        res.json({ success: true, message: 'Код отправлен' });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

app.post('/api/auth/verify', async(req, res) => {
    try {
        const { phone, code } = req.body;

        // Проверка кода (в реальном приложении сравнить с отправленным)
        // if (code !== storedCode) { ... }

        // Создание пользователя
        const user = new User({ phone, cart: [] });
        await user.save();

        // Генерация токена
        const token = jwt.sign({ userId: user._id }, 'YOUR_SECRET_KEY', { expiresIn: '30d' });

        res.json({ token, user: { phone: user.phone, cart: user.cart } });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

app.get('/api/products', async(req, res) => {
    try {
        const { category, search } = req.query;
        let query = {};

        if (category) query.category = category;
        if (search) query.name = { $regex: search, $options: 'i' };

        const products = await Product.find(query);
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

app.post('/api/cart', async(req, res) => {
    try {
        const { userId, productId, weight } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ message: 'Товар не найден' });

        // Добавление в корзину
        user.cart.push({
            productId,
            weight,
            price: product.prices[weight]
        });

        await user.save();
        res.json(user.cart);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

app.post('/api/orders', async(req, res) => {
    try {
        const { userId, items, total, address } = req.body;

        // Создание заказа
        const order = new Order({
            userId,
            items,
            total,
            address,
            status: 'processing',
            createdAt: new Date()
        });

        await order.save();

        // Очистка корзины пользователя
        await User.findByIdAndUpdate(userId, { cart: [] });

        // Отправка уведомления в Telegram
        const message = `Новый заказ #${order._id}\nСумма: ${total} руб.\nТовары: ${items.length}`;
        bot.sendMessage(chatId, message);

        res.json(order);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Запуск сервера
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
