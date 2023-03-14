const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const fs = require('fs');
const db = require('../db');
const utils = require('../Utils');
const jwt = require('../jwt-util');
const moment = require('moment');
const requestIp = require('request-ip');
const commaNumber = require('comma-number');

async function setLog(req, res, next) {
    // const token = req.headers.authorization.split('Bearer ')[1]; // header에서 access token을 가져옵니다.
    // const result = jwt.verify(token); // token을 검증합니다.
    // if (!result.ok) {   // 검증에 실패하거나 토큰이 만료되었다면 클라이언트에게 메세지를 담아서 응답합니다.
    //     res.send({
    //         code: 0,
    //         msg: result.message,
    //     });
    //     return;
    // }

    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    var sql = `SELECT visit FROM ANALYZER_tbl WHERE ip = ? ORDER BY idx DESC LIMIT 0, 1`;
    var params = [ip];
    var rows = await utils.queryResult(sql, params);
    var cnt = 1;
    if (rows[0]) {
        var cnt = rows[0].visit + 1;
    }
    sql = `INSERT INTO ANALYZER_tbl SET ip = ?, agent = ?, visit = ?, created = NOW()`;
    params = [ip, req.headers['user-agent'], cnt];
    await utils.queryResult(sql, params);
    //4분이상 것들 삭제!!
    fs.readdir('./liveuser', async function(err, filelist) {
        for (file of filelist) {
            await fs.readFile('./liveuser/' + file, 'utf8', function(err, data) {
                if (!err) {
                    try {
                        var tmp = data.split('|S|');
                        moment.tz.setDefault("Asia/Seoul");
                        var connTime = moment.unix(tmp[0] / 1000).format('YYYY-MM-DD HH:mm');
                        var minDiff = moment.duration(moment(new Date()).diff(moment(connTime))).asMinutes();
                        if (minDiff > 4) {
                            fs.unlink('./liveuser/' + file, function(err) {
                                if (err) {
                                    console.log(err);
                                }
                            });
                        }
                    } catch (e) {
                        console.log(e);
                    }
                } else {
                    console.log(err);
                }
            });
        }
    });

    //현재 접속자 파일 생성
    var memo = new Date().getTime() + "|S|" + req.baseUrl + req.path;
    fs.writeFile('./liveuser/' + ip, memo, function(err) {
        if (err) {
            console.log(err);
        }
    });
    //
    next();
}

router.get('/get_family_list/:pid', setLog, async function(req, res, next) {
    const pid = req.params.pid;

    var arr = [];
    await new Promise(function(resolve, reject) {
        const sql = `
            SELECT 
                A.idx, 
                A.id, 
                A.name1, 
                A.filename0, 
                A.birth, 
                A.gender, 
                A.is_selected,
                (SELECT height FROM BODY_tbl WHERE memb_idx = A.idx ORDER BY idx DESC LIMIT 1) as height,
                (SELECT weight FROM BODY_tbl WHERE memb_idx = A.idx ORDER BY idx DESC LIMIT 1) as weight
            FROM MEMB_tbl as A
            WHERE A.pid = ? ORDER BY A.birth ASC
        `;
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
        const sql = `SELECT idx, id, name1, filename0, birth, gender, filename0 FROM MEMB_tbl WHERE idx = ?`;
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

    //마지막 몸무게, 키를 가져온다!
    var sql = `SELECT height, weight FROM BODY_tbl WHERE memb_idx = ? ORDER BY idx DESC LIMIT 1`;
    var params = [idx];
    var resultArr = await utils.queryResult(sql, params);
    var resultObj = resultArr[0];
    
    arr.height = resultObj.height;
    arr.weight = resultObj.weight;

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
        const sql = `SELECT idx, name1, birth, gender, filename0 FROM MEMB_tbl WHERE pid = ? AND is_selected = 1`;
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
