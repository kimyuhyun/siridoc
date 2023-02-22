const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const db = require('../db');
const utils = require('../Utils');
const jwt = require('../jwt-util');

function checking(req, res, next) {
    // const token = req.headers.authorization.split('Bearer ')[1]; // header에서 access token을 가져옵니다.
    // const result = jwt.verify(token); // token을 검증합니다.
    // if (!result.ok) {   // 검증에 실패하거나 토큰이 만료되었다면 클라이언트에게 메세지를 담아서 응답합니다.
    //     res.send({
    //         code: 0,
    //         msg: result.message,
    //     });
    //     return;
    // }
    
    next();
}


router.post('/write', checking, async function(req, res, next) {
    var table = req.body.table;
    var idx = req.body.idx;

    delete req.body.idx;
    delete req.body.table;
    delete req.body.created;
    delete req.body.modified;

    var sql = ""
    var records = [];

    for (key in req.body) {
        if (req.body[key] != 'null') {
            if (key == 'pass1') {
                sql += key + '= PASSWORD(?), ';
            } else {
                sql += key + '= ?, ';
            }
            records.push(req.body[key]);
        }
    }

    // console.log(records);return;
    var arr = {};
    if (idx == null) {
        sql = `INSERT INTO ${table} SET ${sql} created = NOW(), modified = NOW() `;
        await db.query(sql, records, function(err, rows, fields) {
            if (!err) {
                arr.code = 1;
                arr.msg = '등록 되었습니다.';
                res.send(arr);
            } else {
                res.send(err);
            }
        });
    } else {
        records.push(idx);
        sql = `UPDATE ${table} SET ${sql} modified = NOW() WHERE idx = ?`;
        await db.query(sql, records, function(err, rows, fields) {
            if (!err) {
                arr.code = 2;
                arr.msg = '수정 되었습니다.';
                arr.record = rows[0];
                res.send(arr);
            } else {
                res.send(err);
            }
        });
    }
    console.log(sql, records);
});

router.post('/delete', checking, async function(req, res, next) {
    const table = req.body.table;
    const idx = req.body.idx;
    const sql = `DELETE FROM ${table} WHERE idx = ?`;
    db.query(sql, idx);
    res.send({
        code: 1,
        msg: '삭제 되었습니다.'
     });
});


module.exports = router;
