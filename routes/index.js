const express = require('express');
const router = express.Router();
const fs = require('fs');
const db = require('../db');
const utils = require('../Utils');
const moment = require('moment');

router.get('/', function(req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    res.render('index.html', {
        title: '올근 api',
        ip: ip,
        session: req.sessionID,
        mode: process.env.NODE_ENV,
    });
});

module.exports = router;
