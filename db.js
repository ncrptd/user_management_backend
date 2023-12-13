const Pool = require('pg').Pool;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'users',
    password: '123456',
    port: 5432,
});

pool.query('SELECT NOW()', (err, result) => {
    if (err) {
        console.error('Error connecting to the database', err);
    } else {
        console.log('Connected to the database:', result.rows[0].now);
    }
});


module.exports = pool