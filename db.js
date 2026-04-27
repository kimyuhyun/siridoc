require("dotenv").config();
const maria = require("mysql2");

const option = {
    host: process.env.DB_HOST,
    port: process.env.DB_SERVER_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
};

var conn = maria.createPool(option);

module.exports = conn;
module.exports.connAccount = option;
