const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const fs = require('fs');
const db = require('../db');
const utils = require('../Utils');
const jwt = require('../jwt-util');
const moment = require('moment');


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

router.get('/get_bmi_data', setLog, async function(req, res, next) {
    //bmi 그래프 데이터!
    var arr = [];
    await new Promise(function(resolve, reject) {
        let sql = `SELECT gender, age, avg FROM BMI_tbl ORDER BY age ASC`;
        db.query(sql, function(err, rows, fields) {
            // console.log(rows);
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

router.get('/get_asm_data', setLog, async function(req, res, next) {
    //asm 그래프 데이터!
    var arr = [];
    await new Promise(function(resolve, reject) {
        let sql = `SELECT gender, age, avg, dvi FROM ASM_tbl ORDER BY age ASC`;
        db.query(sql, function(err, rows, fields) {
            // console.log(rows);
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

router.get('/get_user_info/:idx', setLog, async function(req, res, next) {
    var idx = req.params.idx;

    var arr = {};

    var sql = `SELECT * FROM MEMB_tbl WHERE idx = ?`;
    var params = [idx];
    var resultArr = await utils.queryResult(sql, params);
    var resultObj = await utils.nvl(resultArr[0]);
    // console.log(resultObj);
    arr = resultObj;
    if (arr.id == arr.pid) {
        arr.is_me = true;
    } else {
        arr.is_me = false;
    }

    //신체정보 리스트
    var bodyBmiArr = [];

    sql = `SELECT idx, wdate, height, weight FROM BODY_tbl WHERE memb_idx = ? ORDER BY wdate DESC, idx DESC LIMIT 0 ,10`;
    params = [idx];
    resultArr = await utils.queryResult(sql, params);
    
    var tmp = '';
    var oldAge = '-9999';
    for (obj of resultArr) {
        tmp = utils.getAge2(arr.birth, obj.wdate.split('-')[0]);
        if (tmp != oldAge) {
            oldAge = tmp;
            //bmi 계산
            let w = eval(obj.weight);
            let h = eval(obj.height);
            var tmp2 = w / (h * 0.01 * h * 0.01);
            //

            bodyBmiArr.push({
                age: tmp,
                bmi: tmp2.toFixed(2),
            });
        }
    }
    arr.body_bmi_arr = bodyBmiArr;
    arr.body_arr = utils.nvl(resultArr);


    //근손실 측정 데이터!
    var muscleArr = [];
    var asmArr = [];
    sql = `SELECT idx, status, age, created FROM NEW_MUSCLE_CHECK_tbl WHERE memb_idx = ? ORDER BY created DESC, idx DESC LIMIT 0 ,10`;
    params = [idx];
    resultArr = await utils.queryResult(sql, params);
    var tmp = '', oldAge = '-9999';
    for (obj of resultArr) {
        tmp = obj.age;
        if (tmp != oldAge) {
            oldAge = tmp;
            asmArr.push({
                age: tmp,
                asm: obj.asm,
            });
        }
    }
    muscleArr = utils.nvl(resultArr);
    arr.muscle_arr = muscleArr;
    arr.asm_arr = asmArr;

    res.send(arr);
});



router.get('/get_body_info_detail/:idx', setLog, async function(req, res, next) {
    let idx = req.params.idx;

    var arr = [];
    await new Promise(function(resolve, reject) {
        const sql = `SELECT * FROM BODY_tbl WHERE idx = ?`;
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


router.get('/get_bmi_list/:memb_idx/:birth', setLog, async function(req, res, next) {
    const { memb_idx, birth } = req.params;

    var arr = [];
    await new Promise(function(resolve, reject) {
        let sql = `SELECT idx, wdate, height, weight FROM BODY_tbl WHERE memb_idx = ? ORDER BY wdate DESC, idx DESC`;
        db.query(sql, memb_idx, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(async function(data) {
        arr = utils.nvl(data);
        for (obj of arr) {
            var tmp = await utils.getAge2(birth, obj.wdate.split('-')[0]);

            //bmi 계산
            let w = eval(obj.weight);
            let h = eval(obj.height);
            var tmp2 = w / (h * 0.01 * h * 0.01);
            //
            obj.age = tmp;
            obj.bmi = tmp2.toFixed(2);
        }

        console.log(arr);
    });
    res.send(arr);
});

router.get('/get_muscle_list/:memb_idx', setLog, async function(req, res, next) {
    const memb_idx = req.params.memb_idx;

    var arr = [];
    await new Promise(function(resolve, reject) {
        let sql = ` SELECT idx, status, wdate FROM MUSCLE_tbl WHERE memb_idx = ? ORDER BY wdate DESC, idx DESC `;
        db.query(sql, memb_idx, function(err, rows, fields) {
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

router.get('/get_recommend_list/:memb_idx/:table', setLog, async function(req, res, next) {
    const memb_idx = req.params.memb_idx;
    const table = req.params.table;

    var arr = [];
    await new Promise(function(resolve, reject) {
        const sql = `SELECT * FROM ${table}`;
        db.query(sql, function(err, rows, fields) {
            console.log(rows);
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

router.get('/get_dct_data/:dct_id', setLog, async function(req, res, next) {
    const dct_id = req.params.dct_id;

    var sql = `SELECT name1 FROM MEMB_tbl WHERE id = ? `;
    var params = [dct_id];
    var arr = await utils.queryResult(sql, params);
    console.log(arr);
    res.send(arr[0]);
});

router.get('/match_dct/:memb_idx/:dct_id', setLog, async function(req, res, next) {
    const memb_idx = req.params.memb_idx;
    const dct_id = req.params.dct_id;

    var sql = `UPDATE MEMB_tbl SET dct_id = ? WHERE idx = ?`;
    var params = [dct_id, memb_idx];
    var arr = await utils.queryResult(sql, params);
    console.log(arr);
    res.send(arr);
});

router.get('/', setLog, async function(req, res, next) {

    // var arr = [];
    // await new Promise(function(resolve, reject) {
    //     const sql = ``;
    //     db.query(sql, function(err, rows, fields) {
    //         console.log(rows);
    //         if (!err) {
    //             resolve(rows);
    //         } else {
    //             console.log(err);
    //             res.send(err);
    //             return;
    //         }
    //     });
    // }).then(function(data) {
    //     arr = utils.nvl(data);
    // });
    // res.send(arr);

    res.send('api');
});



module.exports = router;
