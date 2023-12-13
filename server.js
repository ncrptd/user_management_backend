const express = require("express"),
    bodyParser = require("body-parser"),
    swaggerJsdoc = require("swagger-jsdoc"),
    swaggerUi = require("swagger-ui-express");
const app = express();
const port = 3000;
const cors = require('cors')
const authRoutes = require('./src/auth/routes');
const userRoutes = require('./src/users/routes');
const tenantRoutes = require('./src/tenants/routes');
const authVerify = require('./src/middlewares/authVerify');

app.use(cors())
app.use(express.json());


const options = {
    definition: {
        openapi: "3.1.0",
        info: {
            title: "User Management Express API with Swagger",
            version: "0.1.0"
        },
        servers: [
            {
                url: "http://localhost:3000/",
            },
        ],
    },
    apis: ["./routes/*.js"],
};

const specs = swaggerJsdoc(options);
app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(specs)
);
app.get('/', (req, res) => {
    res.send('Hello, world')
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/tenants', tenantRoutes)

app.listen(port, () => {
    console.log('App Listening on Port ', port)
})