const express = require('express');
const router = express.Router();
const fs = require('fs');
const db = require('../db');
const utils = require('../Utils');
const moment = require('moment');


async function setLog(req, res, next) {
    const ip = req.sessionID;
    var rows;
    await new Promise(function(resolve, reject) {
        const sql = `SELECT visit FROM ANALYZER_tbl WHERE ip = ? ORDER BY idx DESC LIMIT 0, 1`;
        db.query(sql, ip, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            }
        });
    }).then(function(data){
        rows = data;
    });

    await new Promise(function(resolve, reject) {
        const sql = `INSERT INTO ANALYZER_tbl SET ip = ?, agent = ?, visit = ?, created = NOW()`;
        if (rows.length > 0) {
            var cnt = rows[0].visit + 1;
            db.query(sql, [ip, req.headers['user-agent'], cnt], function(err, rows, fields) {
                resolve(cnt);
            });
        } else {
            db.query(sql, [ip, req.headers['user-agent'], 1], function(err, rows, fields) {
                resolve(1);
            });
        }
    }).then(function(data) {
        console.log(data);
    });

    //현재 접속자 파일 생성
    var memo = new Date().getTime() + "|S|" + req.baseUrl + req.path;
    fs.writeFile('./liveuser/'+ip, memo, function(err) {
        console.log(err, memo);
    });
    //
    next();
}

router.get('/', function(req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    const sql = `SELECT visit FROM ANALYZER_tbl ORDER BY idx DESC LIMIT 0, 10`;
    db.query(sql, function(err, rows, fields) {
        if (!err) {
            console.log(rows);
        }
    });

    res.render('index.html', {
        title: '올근 api',
        session: `${ip}`,
        mode: process.env.NODE_ENV,
    });
});

module.exports = router;
