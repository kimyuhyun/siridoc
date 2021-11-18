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

router.get('/get_bmi_data', setLog, async function(req, res, next) {
    //bmi 그래프 데이터!
    var arr = [];
    await new Promise(function(resolve, reject) {
        let sql = `SELECT gender, age, avg FROM BMI_tbl ORDER BY age ASC`;
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

router.get('/get_user_info/:idx', setLog, async function(req, res, next) {
    let idx = req.params.idx;

    var arr = {};
    await new Promise(function(resolve, reject) {
        let sql = `SELECT * FROM MEMB_tbl WHERE idx = ?`;
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
        // console.log(data);
        arr = utils.nvl(data);
        if (arr.id == arr.pid) {
            arr.is_me = true;
        } else {
            arr.is_me = false;
        }
    });

    //신체정보 리스트
    var bodyArr = [];
    var bodyBmiArr = [];
    await new Promise(function(resolve, reject) {
        let sql = `SELECT idx, wdate, height, weight FROM BODY_tbl WHERE memb_idx = ? ORDER BY wdate DESC, idx DESC LIMIT 0 ,4`;
        db.query(sql, idx, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        var tmp = '', oldAge = '-9999';

        for (obj of data) {
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

        bodyArr = utils.nvl(data);
    });
    arr.body_bmi_arr = bodyBmiArr;
    arr.body_arr = bodyArr;


    //근손실 측정 데이터!
    var muscleArr = [];
    await new Promise(function(resolve, reject) {
        let sql = `
            SELECT idx, status, gender, wdate, val0, val1, val2, val3, val4, val5, val6, val7, val8 FROM MUSCLE_tbl
            WHERE memb_idx = ? ORDER BY wdate DESC, idx DESC LIMIT 0 ,4
        `;
        db.query(sql, idx, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        muscleArr = utils.nvl(data);
    });
    arr.muscle_arr = muscleArr;



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
