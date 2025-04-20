const mysql = require('mysql2');

//database connection
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'academic_progression_app',
    port: '3306'
});

module.exports = db;