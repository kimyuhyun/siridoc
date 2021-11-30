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



router.post('/check_step1', setLog, async function(req, res, next) {
    let { idx, memb_idx, wdate, gender, val0, val1, val2 } = req.body;
    var v0 = false, v1 = false, v2 = false;
    var arr = {};
/**
* step1 -> step2
* true, true, true
* true, true, false
* true, false, true
*/


    if (gender == 1) {
        v0 = eval(val0) < 34;
        v1 = eval(val1) < 28;
        v2 = eval(val2) >= 12;
    } else {
        v0 = eval(val0) < 33;
        v1 = eval(val1) < 18;
        v2 = eval(val2) >= 12;
    }

    console.log(v0, v1, v2);

    if (v0) {
        if (v1 && v2) {
            arr.msg = "당신은 근감소증이 진행중 입니다.\n다음 단계 진단을 진행하겠습니다";
            arr.code = 0;
        } else if (v1 && !v2) {
            arr.msg = "당신은 근감소증이 진행중 입니다.\n다음 단계 진단을 진행하겠습니다";
            arr.code = 0;
        } else if (!v1 && v2) {
            arr.msg = "당신은 근감소증이 진행중 입니다.\n다음 단계 진단을 진행하겠습니다";
            arr.code = 0;
        } else if (!v1 && !v2) {
            arr.msg = "당신은 근감소증이 아닙니다.\n확인을 누르면 홈화면으로 이동합니다.";
            arr.code = 1;
        }
    } else {
        arr.msg = "당신은 근감소증이 아닙니다.\n확인을 누르면 홈화면으로 이동합니다.";
        arr.code = 1;
    }

    if (arr.code == 1) {
        await new Promise(function(resolve, reject) {
            if (idx) {
                const sql = `UPDATE MUSCLE_tbl SET val0 = ?, val1 = ?, val2 = ?, status = ?, gender = ?, memb_idx = ?, modified = NOW() WHERE idx = ?`;
                db.query(sql, [val0, val1, val2, arr.code, gender, memb_idx, idx], function(err, rows, fields) {
                    console.log(rows);
                    if (!err) {
                        resolve(rows);
                    } else {
                        console.log(err);
                        res.send(err);
                        return;
                    }
                });
            } else {
                const sql = `INSERT INTO MUSCLE_tbl SET wdate = ?, val0 = ?, val1 = ?, val2 = ?, status = ?, gender = ?, memb_idx = ?, created = NOW(), modified = NOW()`;
                db.query(sql, [wdate, val0, val1, val2, arr.code, gender, memb_idx], function(err, rows, fields) {
                    console.log(rows);
                    if (!err) {
                        resolve(rows);
                    } else {
                        console.log(err);
                        res.send(err);
                        return;
                    }
                });
            }
        }).then(function(data) {
            idx = data.insertId;
            arr.idx = idx;
        });
    }
    res.send(arr);
});

router.post('/check_step2', setLog, async function(req, res, next) {
    let { idx, memb_idx, wdate, gender, val0, val1, val2, val3, val4, val5, val6, val7, val8 } = req.body;
    var v0 = false, v1 = false, v2 = false;
    var arr = {};

    //악력 체크!
    if (gender == 1) {
        v0 = eval(val3) < 28;
    } else {
        v0 = eval(val3) < 18;
    }
    //

    //활동능력체크!
    if (eval(val4) < 1.0 || eval(val5) >= 12 || eval(val6) <= 9) {
        //6미터 보행 속도!, 5회 스쿼트 시간!, Short Physical Performance Battery
        v1 = true;
    }
    //

    //ASM
    if (gender == 1) {
        if (eval(val7) < 7 || eval(val8) < 7) {     //DAX, ASM
            v2 = true;
        }
    } else {
        if (eval(val7) < 5.4 || eval(val8) < 5.7) {     //DAX, ASM
            v2 = true;
        }
    }
    //

    console.log(v0, v1, v2);

    if (v0 && v1 && !v2) {
        arr.msg = "당신은 보통 수준의 근감소증이 진행중 입니다.";
        arr.code = 2;
    } else if (v0 && v1 && v2) {
        arr.msg = "당신은 심각 수준의 근감소증이 진행중 입니다.";
        arr.code = 3;
    } else {
        arr.msg = `Error: Low muscle: ${v0}, Low physical: ${v1}, Low ASM: ${v2}`;
        arr.code = 0;
    }


    await new Promise(function(resolve, reject) {
        if (idx) {
            const sql = `
                UPDATE MUSCLE_tbl SET
                val0 = ?,
                val1 = ?,
                val2 = ?,
                val3 = ?,
                val4 = ?,
                val5 = ?,
                val6 = ?,
                val7 = ?,
                val8 = ?,
                status = ?,
                gender = ?,
                memb_idx = ?,
                modified = NOW()
                WHERE idx = ?`;
            db.query(sql, [val0, val1, val2, val3, val4, val5, val6, val7, val8, arr.code, gender, memb_idx, idx], function(err, rows, fields) {
                console.log(rows);
                if (!err) {
                    resolve(rows);
                } else {
                    console.log(err);
                    res.send(err);
                    return;
                }
            });
        } else {
            const sql = `
                INSERT INTO MUSCLE_tbl SET
                val0 = ?,
                val1 = ?,
                val2 = ?,
                val3 = ?,
                val4 = ?,
                val5 = ?,
                val6 = ?,
                val7 = ?,
                val8 = ?,
                wdate = ?,
                status = ?,
                gender = ?,
                memb_idx = ?,
                created = NOW(),
                modified = NOW()`;
            db.query(sql, [val0, val1, val2, val3, val4, val5, val6, val7, val8 ,wdate, arr.code, gender, memb_idx], function(err, rows, fields) {
                console.log(rows);
                if (!err) {
                    resolve(rows);
                } else {
                    console.log(err);
                    res.send(err);
                    return;
                }
            });
        }
    }).then();

    res.send(arr);

});


router.get('/get_muscle_detail/:idx', setLog, async function(req, res, next) {
    let idx = req.params.idx;
    var arr = {};
    await new Promise(function(resolve, reject) {
        const sql = `SELECT * FROM MUSCLE_tbl WHERE idx = ?`;
        db.query(sql, idx, function(err, rows, fields) {
            console.log(rows);
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


module.exports = router;
