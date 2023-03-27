const express = require('express');
const router = express.Router();
const fs = require('fs');
const db = require('../db');
const utils = require('../Utils');
const moment = require('moment');
const gumjinPoint = require('../GumjinPoint');

async function setLog(req, res, next) {
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
    var result = await utils.queryResult(sql, params);

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



router.get('/detail/:memb_idx', setLog, async function(req, res, next) {
    const memb_idx = req.params.memb_idx;

    var obj = {};

    //키, 몸무게
    var sql = `SELECT height, weight FROM BODY_tbl WHERE memb_idx = ? ORDER BY wdate DESC, idx DESC LIMIT 0 ,1`;
    var params = [memb_idx];
    var resultArr = await utils.queryResult(sql, params);
    var resultObj = resultArr[0];
    
    obj.user_info = resultObj;

    //기본정보
    // sql = `SELECT url, name1, desc1, filename0 FROM HEALTH_BLOG_tbl ORDER BY idx DESC LIMIT 0 ,10`;
    // params = [];
    // resultArr = await utils.queryResult(sql, params);
    // obj.blog = resultArr;

   
    

    res.send(obj);
});

router.get('/get_gumjin_graph/:memb_idx', setLog, async function(req, res, next) {
    const memb_idx = req.params.memb_idx;

    var sql = `SELECT gender FROM MEMB_tbl WHERE idx = ?`;
    var params = [memb_idx];
    var resultArr = await utils.queryResult(sql, params);
    var resultObj = await utils.nvl(resultArr[0]);
    if (!resultObj) {
        res.send([]);
        return;
    }
    var gender = resultObj.gender;

    var sql = `SELECT squat, akruk, jongari, asm, created FROM NEW_MUSCLE_CHECK_tbl WHERE memb_idx = ? ORDER BY created DESC, idx DESC LIMIT 0 ,6`;
    var params = [memb_idx];
    var resultArr = await utils.queryResult(sql, params);

    var arr = [];
    for (obj of resultArr) {
        obj.created = moment(obj.created).format('MM/DD');
        if (obj.squat == '') {
            obj.squat = 0;
        }

        if (obj.akruk == '') {
            obj.akruk = 0;
        }

        if (obj.jongari == '') {
            obj.jongari = 0;
        }

        if (obj.asm == '') {
            obj.asm = 0;
        }

        obj.squat_point = gumjinPoint.getSquatPoint(obj.squat);
        obj.akruk_point = gumjinPoint.getAkrukPoint(gender, obj.akruk);
        obj.jongari_point = gumjinPoint.getJongariPoint(gender, obj.jongari);
        obj.asm_point = gumjinPoint.getASMPoint(gender, obj.asm);

        
        arr.push(obj);
    }

    var emptyCnt = 6 - arr.length;
    if (emptyCnt > 0) {
        for (var i = 0; i < emptyCnt; i++) {
            arr.push({
                squat: 0,
                akruk: 0,
                jongari: 0,
                asm: 0,
                created: '',
            });
        }
    }

    res.send(arr);
});

router.get('/get_bmi_graph/:memb_idx', setLog, async function(req, res, next) {
    const memb_idx = req.params.memb_idx;

    var sql = `SELECT * FROM MEMB_tbl WHERE idx = ?`;
    var params = [memb_idx];
    var resultArr = await utils.queryResult(sql, params);
    var resultObj = await utils.nvl(resultArr[0]);

    if (!resultObj) {
        const result = {
            avg: 0,
            age: 0,
            bmi_list: [
                gumjinPoint.getBMIObject(0),
                gumjinPoint.getBMIObject(0),
                gumjinPoint.getBMIObject(0),
                gumjinPoint.getBMIObject(0),
                gumjinPoint.getBMIObject(0),
                gumjinPoint.getBMIObject(0),
            ],
        };
        res.send(result);
        return;
    }

    var birth = resultObj.birth;
    var gender = resultObj.gender;
        
    var bmiArr = [];
        
    sql = `
        SELECT Z.idx, Z.wdate, Z.height, Z.weight FROM (
            SELECT * FROM BODY_tbl WHERE memb_idx = ? ORDER BY created DESC LIMIT 100
        ) as Z
        GROUP BY wdate ORDER BY wdate DESC LIMIT 0 ,6
    `;
    params = [memb_idx];
    resultArr = await utils.queryResult(sql, params);
    resultArr = resultArr.reverse();
    var age = 0;
    for (obj of resultArr) {
        age = utils.getAge2(birth, obj.wdate.split('-')[0]);
        
        //bmi 계산
        let w = eval(obj.weight);
        let h = eval(obj.height);
        var tmp2 = w / (h * 0.01 * h * 0.01);
        //

        var bmiObj = gumjinPoint.getBMIObject(tmp2.toFixed(2), moment(obj.wdate).format('MM/DD'));
        bmiArr.push(bmiObj);
    }

    var emptyCnt = 6 - bmiArr.length;
    if (emptyCnt > 0) {
        for (var i = 0; i < emptyCnt; i++) {
            bmiArr.unshift(gumjinPoint.getBMIObject(0));
        }
    }

    sql = `SELECT gender, age, avg FROM ASM_tbl WHERE age = ? AND gender = ?`;
    params = [age, gender];
    resultArr = await utils.queryResult(sql, params);
    resultObj = resultArr[0];
    console.log(resultObj);

    var result = {};
    if (resultObj) {
        result.avg = resultObj.avg.toFixed(2);
    } else {
        result.avg = 0;
    }
    result.age = age;
    result.bmi_list = bmiArr;
    res.send(result);
});

module.exports = router;
