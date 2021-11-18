const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const fs = require('fs');
const db = require('../db');
const utils = require('../Utils');
const moment = require('moment');


async function setLog(req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    var rows;
    await new Promise(function(resolve, reject) {
        var sql = `SELECT visit FROM ANALYZER_tbl WHERE ip = ? ORDER BY idx DESC LIMIT 0, 1`;
        db.query(sql, ip, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            }
        });
    }).then(function(data){
        rows = data;
    });

    await new Promise(function(resolve, reject) {
        var sql = `INSERT INTO ANALYZER_tbl SET ip = ?, agent = ?, visit = ?, created = NOW()`;
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
        console.log(memo);
    });
    //
    next();
}

router.get('/is_member/:id', setLog, async function(req, res, next) {
    const id = req.params.id;
    var arr = {};

    var cnt = 0;
    await new Promise(function(resolve, reject) {
        const sql = `SELECT COUNT(*) as cnt FROM MEMB_tbl WHERE id = ?`;
        db.query(sql, id, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        cnt = data.cnt;
    });

    if (cnt > 0) {
        await new Promise(function(resolve, reject) {
            const sql = `SELECT idx, pid, id, name1, birth, gender, email FROM MEMB_tbl WHERE id = ?`;
            db.query(sql, id, function(err, rows, fields) {
                if (!err) {
                    resolve(rows[0]);
                } else {
                    console.log(err);
                    res.send(err);
                    return;
                }
            });
        }).then(function(data) {
            if (data) {
                arr = utils.nvl(data);
                arr.code = 1;
            }
        });

        await new Promise(function(resolve, reject) {
            const sql = `SELECT idx, name1, birth, gender FROM MEMB_tbl WHERE pid = ? AND is_selected = 1`;
            db.query(sql, [id, id], function(err, rows, fields) {
                if (!err) {
                    resolve(rows[0]);
                } else {
                    console.log(err);
                    res.send(err);
                    return;
                }
            });
        }).then(function(data) {
            if (data) {
                arr.selected_idx = data.idx;
                arr.selected_name1 = data.name1;
                arr.selected_birth = data.birth;
                arr.selected_gender = data.gender;
            } else {
                arr.selected_idx = arr.idx;
                arr.selected_name1 = arr.name1;
                arr.selected_birth = arr.birth;
                arr.selected_gender = arr.gender;
                console.log(arr);
            }
            arr.code = 1;
        });

    } else {
        arr.code = 0;
    }

    if (arr.id == arr.pid) {
        arr.is_me = true;
    }

    res.send(arr);

    //마지막 접속일 업데이트!
    if (arr.code == 1) {
        db.query(`UPDATE MEMB_tbl SET modified = NOW() WHERE id = ?`, id);
    }
    //
});

router.post('/register', setLog, async function(req, res, next) {
    const { id, name1, birth, gender, email, height, weight } = req.body;
    var idx = 0;

    await new Promise(function(resolve, reject) {
        const sql = `INSERT INTO MEMB_tbl SET pid = ?, id = ?, name1 =?, birth = ?, gender = ?, email = ?, is_selected = 1, created = NOW(), modified = NOW()`;
        db.query(sql, [id, id, name1, birth, gender, email], function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        idx = data.insertId;
    });

    let wdate = moment().format('YYYY-MM-DD');

    await new Promise(function(resolve, reject) {
        const sql = `INSERT INTO BODY_tbl SET memb_idx = ?, wdate = ?, weight = ?, height =?, created = NOW(), modified = NOW()`;
        db.query(sql, [idx, wdate, weight, height], function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        res.send({
            code: 1,
        });
    });
});

router.post('/member_leave', setLog, async function(req, res, next) {
    let table = req.body.table;
    let id = req.body.id;
    let sql = `DELETE FROM ${table} WHERE pid = ?`;
    await db.query(sql, id);
    res.send({
        code: 1,
        msg: '삭제 되었습니다.'
     });
});



module.exports = router;
