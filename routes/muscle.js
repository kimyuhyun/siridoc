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



router.post('/check_step1', setLog, async function(req, res, next) {
    let { idx, memb_idx, wdate, gender, sarc_f, val0, val1, val2 } = req.body;
    var v0 = false, v1 = false, v2 = false;
    var arr = {};
/**
* step1 -> step2
* true, true, true
* true, true, false
* true, false, true
*/


    if (gender == 1) {
        if (eval(val0) < 34 || eval(sarc_f) <= 4) {
            v0 = true;
        }
        v1 = eval(val1) < 28;
    } else {
        if (eval(val0) < 33 || eval(sarc_f) <= 4) {
            v0 = true;
        }
        v1 = eval(val1) < 18;
    }

    v2 = eval(val2) >= 12;

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
                const sql = `UPDATE MUSCLE_tbl SET sarc_f = ?, val0 = ?, val1 = ?, val2 = ?, status = ?, gender = ?, memb_idx = ?, modified = NOW() WHERE idx = ?`;
                db.query(sql, [sarc_f, val0, val1, val2, arr.code, gender, memb_idx, idx], function(err, rows, fields) {
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
                const sql = `INSERT INTO MUSCLE_tbl SET wdate = ?, sarc_f = ?, val0 = ?, val1 = ?, val2 = ?, status = ?, gender = ?, memb_idx = ?, created = NOW(), modified = NOW()`;
                db.query(sql, [wdate, sarc_f, val0, val1, val2, arr.code, gender, memb_idx], function(err, rows, fields) {
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
    let { idx, memb_idx, wdate, gender, sarc_f, val0, val1, val2, val3, val4, val5, val6, val7, val8 } = req.body;
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
        // arr.msg = `Error: Low muscle: ${v0}, Low physical: ${v1}, Low ASM: ${v2}`;
        // arr.code = 0;
        arr.msg = "당신은 근감소증이 아닙니다.";
        arr.code = 1;
    }


    await new Promise(function(resolve, reject) {
        if (idx) {
            const sql = `
                UPDATE MUSCLE_tbl SET
                sarc_f = ?,
                wdate = ?,
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
            db.query(sql, [sarc_f, wdate, val0, val1, val2, val3, val4, val5, val6, val7, val8, arr.code, gender, memb_idx, idx], function(err, rows, fields) {
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
                sarc_f = ?,
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
            db.query(sql, [sarc_f, val0, val1, val2, val3, val4, val5, val6, val7, val8 ,wdate, arr.code, gender, memb_idx], function(err, rows, fields) {
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
        arr.rows = req.body;
    });
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
