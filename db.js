const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT,
});

// Function to connect to the database
async function connectDatabase() {
    try {
        // Wait for the connection to establish
        const client = await pool.connect();
        // Query to get current timestamp from the database
        const result = await client.query('SELECT NOW()');
        // Log the timestamp
        console.log('Connected to the database:', result.rows[0].now);
        // Release the client back to the pool
        client.release();
    } catch (error) {
        console.error('Error connecting to the database', error);
        throw error; // Rethrow the error to handle it in the calling function
    }
}

// Call the function to connect to the database
connectDatabase();

// Export the pool for using it in other modules
module.exports = pool;
