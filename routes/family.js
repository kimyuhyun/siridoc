const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const fs = require('fs');
const db = require('../db');
const utils = require('../Utils');
const moment = require('moment');
const requestIp = require('request-ip');
const commaNumber = require('comma-number');

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

router.get('/get_family_list/:pid', setLog, async function(req, res, next) {
    const pid = req.params.pid;

    var arr = [];
    await new Promise(function(resolve, reject) {
        const sql = `SELECT idx, id, name1, birth, gender, is_selected FROM MEMB_tbl WHERE pid = ? ORDER BY birth ASC`;
        db.query(sql, pid, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        arr = utils.nvl(data);
    });
    res.send(arr);
});

router.get('/get_family_detail/:idx', setLog, async function(req, res, next) {
    const idx = req.params.idx;

    var arr = {};
    await new Promise(function(resolve, reject) {
        const sql = `SELECT idx, id, name1, birth, gender FROM MEMB_tbl WHERE idx = ?`;
        db.query(sql, idx, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        arr = utils.nvl(data);
    });
    res.send(arr);
});

router.get('/get_family_select_check/:pid', setLog, async function(req, res, next) {
    const pid = req.params.pid;

    await new Promise(function(resolve, reject) {
        const sql = `SELECT COUNT(*) as cnt FROM MEMB_tbl WHERE is_selected = 1 AND pid = ?`;
        db.query(sql, pid, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function (data) {
        res.send({ cnt: data.cnt });
    });
});


router.post('/set_family_select', setLog, async function(req, res, next) {
    const { pid, idx } = req.body;

    await new Promise(function(resolve, reject) {
        const sql = `UPDATE MEMB_tbl SET is_selected = 0 WHERE pid = ?`;
        db.query(sql, pid, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then();

    await new Promise(function(resolve, reject) {
        const sql = `UPDATE MEMB_tbl SET is_selected = 1 WHERE pid = ? AND idx = ?`;
        db.query(sql, [pid, idx], function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then();

    var arr = {};
    await new Promise(function(resolve, reject) {
        const sql = `SELECT idx, name1, birth FROM MEMB_tbl WHERE pid = ? AND is_selected = 1`;
        db.query(sql, pid, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        arr = utils.nvl(data);
    });

    res.send(arr);
});


router.post('/set_family', setLog, async function(req, res, next) {
    const { pid, name1, birth, gender, height, weight } = req.body;
    var idx = req.body.idx;

    if (idx) {
        await new Promise(function(resolve, reject) {
            const sql = `UPDATE MEMB_tbl SET name1 =?, birth = ?, gender = ?, modified = NOW() WHERE idx = ?`;
            db.query(sql, [name1, birth, gender, idx], function(err, rows, fields) {
                if (!err) {
                    resolve(rows);
                } else {
                    console.log(err);
                    res.send(err);
                    return;
                }
            });
        }).then();
    } else {
        await new Promise(function(resolve, reject) {
            const sql = `INSERT INTO MEMB_tbl SET pid = ?, name1 =?, birth = ?, gender = ?, created = NOW(), modified = NOW()`;
            db.query(sql, [pid, name1, birth, gender], function(err, rows, fields) {
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
        }).then();
    }

    res.send({
        code: 1,
    });

});



module.exports = router;
