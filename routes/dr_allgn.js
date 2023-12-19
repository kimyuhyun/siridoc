const express = require("express");
const router = express.Router();
const fs = require("fs");
const utils = require("../Utils");
const moment = require("moment");
const gumjinPoint = require("../GumjinPoint");

router.get("/get_patient_list", async function (req, res, next) {
    const dct_id = req.query.dct_id || "";
    var search_txt = req.query.search_txt || "";
    var page = req.query.page || 1;
    page = (page - 1) * 20;

    const params = [];

    var sql = `SELECT idx, name1, birth, gender FROM MEMB_tbl WHERE level1 = 9`;

    if (dct_id) {
        params.push(dct_id);
        sql += ` AND dct_id = ?`;
    }

    if (search_txt) {
        search_txt = `%${search_txt}%`;
        sql += ` AND (patient_num LIKE ? OR name1 LIKE ? OR birth LIKE ?)`;
        params.push(search_txt);
        params.push(search_txt);
    }

    params.push(page);
    sql += ` ORDER BY name1 ASC LIMIT ?, 20`;

    const arr = await utils.queryResult(sql, params);
    res.json(arr);
});

router.get('/get_patient_detail', async function(req, res, next) {
    const memb_idx = req.query.memb_idx || '';
    if (memb_idx == '') {
        res.json({
            code: 0,
            msg: 'memb_idx is empty'
        });
        return;
    }

    const result = {
        code: 1,
    };

    var sql = `SELECT * FROM MEMB_tbl WHERE idx = ?`;
    var arr = await utils.queryResult(sql, [memb_idx]);
    var obj = arr[0];
    result.info = obj;

    //성별가져오기!
    const gender = obj.gender;

    sql = `SELECT * FROM NEW_MUSCLE_CHECK_tbl WHERE memb_idx = ? ORDER BY created DESC, idx DESC`;
    arr = await utils.queryResult(sql, [memb_idx]);

    // 각각의 측정 항목을 1,2,3 점으로 변환한다! 1: 미달, 2: 보통, 3: 양호
    for (obj of arr) {
        obj.squat_point = gumjinPoint.getSquatPoint(obj.squat);
        obj.akruk_point = gumjinPoint.getAkrukPoint(gender, obj.akruk);
        obj.jongari_point = gumjinPoint.getJongariPoint(gender, obj.jongari);
        obj.asm_point = gumjinPoint.getASMPoint(gender, obj.asm);

        var pointSum = eval(obj.squat_point) + eval(obj.akruk_point);

        //ASM 있으면 asm 더한다!
        if (obj.asm_point > 0) {
            pointSum += eval(obj.asm_point);
        } else {
            pointSum += eval(obj.jongari_point);
        }
        obj.point_sum = pointSum;
        // obj.squat_graph_json = JSON.parse(obj.squat_graph_json);
    }

    result.list = arr;

    res.send(result);
});

module.exports = router;
