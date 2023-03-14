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



router.post('/basic_check', setLog, async function(req, res, next) {
    const { jongari, sarc_f, gender, memb_idx } = req.body;

    var check1 = false;
    var check2 = false;

    if (gender == 1) {
        if (jongari < 34) {
            check1 = true;
        }
    } else {
        if (jongari < 33) {
            check1 = true;
        }
    }

    if (sarc_f >= 4) {
        check2 = true;
    }

    if (!check1 && !check2) {
        res.send({
            code: 1,
            msg: '근감소증이 아닙니다.'
        });
    } else {
        res.send({
            code: 2,
            msg: '근감소증 의심되어 다음단계를 진행하겠습니다.'
        });
    }

});

router.post('/save_detail_input_data', setLog, async function(req, res, next) {
    var params = [];
    var sql = '';
    for (key in req.body) {
        if (req.body[key] != 'null') {
            sql += key + '= ?, ';
            if (req.body[key]) {
                params.push(req.body[key]);
            } else {
                params.push(0);
            }
        }
    }
    sql = `INSERT INTO MUSCLE_CHECK_tbl SET ${sql} created = NOW(), modified = NOW()`;
    var arr = await utils.queryResult(sql, params);
    console.log(arr);

    res.send(arr);
});


router.get('/get_muscle_check_result/:idx', setLog, async function(req, res, next) {
    const idx = req.params.idx;

    var sql = `SELECT * FROM MUSCLE_CHECK_tbl WHERE idx = ?`;
    var params = [idx];
    var arr = await utils.queryResult(sql, params);
    var obj = arr[0];


    var check1 = false; //근력!
    var check2 = false; //ASM!
    var check3 = false; //활동능력!

    //근력체크!
    if (obj.gender == 1) {
        if (obj.akruk < 28) {
            check1 = true;
        }
    } else if (obj.gender == 2) {
        if (obj.akruk < 18) {
            check1 = true;
        }
    }
    //

    //ASM체크!
    if (obj.gender == 1) {
        if (obj.asm < 7) {
            check2 = true;
        }
    } else if (obj.gender == 2) {
        if (obj.akruk < 5.7) {
            check2 = true;
        }
    }
    //

    //활동능력 체크! 하나라도 걸리면 yes
    if (obj.squat >= 12 || obj.walking_speed < 1.0 || obj.sppb <= 9) {
        check3 = true;
    }
    //

    var checkArr = [check1, check2, check3];
    console.log(checkArr);
    var cnt = 0;
    for (b of checkArr) {
        if (b) {
            cnt++;
        }
    }

    console.log(cnt);

    //status 업데이트!
    sql = `UPDATE MUSCLE_CHECK_tbl SET status = ? WHERE idx = ?`;
    var params2 = [cnt, idx];
    await utils.queryResult(sql, params2);
    //

    res.send({
        status: cnt,
        check1: check1,
        check2: check2,
        check3: check3,
    });
});


router.get('/get_muscle_check_list/:memb_idx', setLog, async function(req, res, next) {
    const memb_idx = req.params.memb_idx;
    var sql = `SELECT idx, status, wdate FROM MUSCLE_CHECK_tbl WHERE memb_idx = ? ORDER BY idx DESC`;
    var params = [memb_idx];
    var arr = await utils.queryResult(sql, params);
    res.send(arr);
});

module.exports = router;
