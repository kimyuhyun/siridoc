const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const fs = require('fs');
const db = require('../db');
const utils = require('../Utils');
const moment = require('moment');
const requestIp = require('request-ip');
const commaNumber = require('comma-number');



router.get('/hardware_check_list/:memb_idx', async function(req, res, next) {
    const memb_idx = req.params.memb_idx;

    var sql = `
        SELECT 
        A.* 
        FROM NEW_MUSCLE_CHECK_tbl as A WHERE memb_idx = ? ORDER BY created DESC, idx DESC
    `;
    var params = [memb_idx];
    var arr = await utils.queryResult(sql, params);
    console.log(arr);

    res.send(arr);
});

router.post('/hardware_check_add', async function(req, res, next) {
    console.log(req.body);

    const { memb_idx, gender, age, jongari, akruk, squat, wdate } = req.body;

    var point1 = 0;
    var point2 = 0;
    var point3 = 0;

    //종아리 둘레 체크!
    if (gender == 1) {
        if (jongari < 34) {
            point1 = 1;
        }
    } else {
        if (jongari < 33) {
            point1 = 1;
        }
    }
    //

    //악력 체크!
    if (gender == 1) {
        if (akruk < 28) {
            point2 = 1;
        }
    } else {
        if (akruk < 18) {
            point2 = 1;
        }
    }
    //

    //활동능력 체크!
    if (squat >= 12) {
        point3 = 1;
    }
    //

    var status = point1 + point2 + point3;



    var sql = `
        INSERT INTO NEW_MUSCLE_CHECK_tbl SET 
            memb_idx = ?,
            status = ?,
            gender = ?,
            age = ?,
            jongari = ?,
            akruk = ?,
            squat = ?,
            created = ?,
            is_flag1 = ?,
            is_flag2 = ?,
            is_flag3 = ?
    `;
    var params = [memb_idx, status, gender, age, jongari, akruk, squat, wdate, point1, point2, point3];
    var rs = await utils.queryResult(sql, params);
    console.log(rs);

    res.send(rs);
});

router.get('/hardware_check_result/:idx', async function(req, res, next) {
    const idx = req.params.idx;

    var sql = `
        SELECT 
        (SELECT name1 FROM MEMB_tbl WHERE idx = A.memb_idx) as name1,
        A.* 
        FROM NEW_MUSCLE_CHECK_tbl as A WHERE idx = ? ORDER BY idx DESC
    `;
    var params = [idx];
    var arr = await utils.queryResult(sql, params);
    console.log(arr);
    var obj = arr[0];
    

    res.send(obj);
});

module.exports = router;
