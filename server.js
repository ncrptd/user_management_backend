require('dotenv').config();
const express = require("express");
const app = express();
const port = process.env.SERVER_PORT || 3000;
const cors = require('cors');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage });

const authRoutes = require('./src/auth/routes');
const userRoutes = require('./src/users/routes');
const tenantRoutes = require('./src/tenants/routes');
const uploadRoutes = require('./src/upload/routes');
const configurationRoutes = require('./src/configuration/routes');

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello, world');
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/tenants', tenantRoutes);

app.use('/api/v1/upload', upload.single('file'), uploadRoutes);
app.use('/api/v1/config', upload.single('configFile'), configurationRoutes);

app.listen(port, () => {
    console.log('App Listening on Port ', port);
});
