const express = require("express");
const router = express.Router();
const fs = require("fs");
const db = require("../db");
const utils = require("../Utils");
const moment = require("moment");
const gumjinPoint = require("../GumjinPoint");

async function setLog(req, res, next) {
    const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    var sql = `SELECT visit FROM ANALYZER_tbl WHERE ip = ? ORDER BY idx DESC LIMIT 0, 1`;
    var params = [ip];
    var rows = await utils.queryResult(sql, params);

    var cnt = 1;
    if (rows[0]) {
        var cnt = rows[0].visit + 1;
    }

    sql = `INSERT INTO ANALYZER_tbl SET ip = ?, agent = ?, visit = ?, created = NOW()`;
    params = [ip, req.headers["user-agent"], cnt];
    var result = await utils.queryResult(sql, params);

    //4분이상 것들 삭제!!
    fs.readdir("./liveuser", async function (err, filelist) {
        for (file of filelist) {
            await fs.readFile("./liveuser/" + file, "utf8", function (err, data) {
                if (!err) {
                    try {
                        var tmp = data.split("|S|");
                        moment.tz.setDefault("Asia/Seoul");
                        var connTime = moment.unix(tmp[0] / 1000).format("YYYY-MM-DD HH:mm");
                        var minDiff = moment.duration(moment(new Date()).diff(moment(connTime))).asMinutes();
                        if (minDiff > 4) {
                            fs.unlink("./liveuser/" + file, function (err) {
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
    fs.writeFile("./liveuser/" + ip, memo, function (err) {
        if (err) {
            console.log(err);
        }
    });
    //
    next();
}

router.get("/latest/:memb_idx", setLog, async function (req, res, next) {
    const memb_idx = req.params.memb_idx;

    //성별가져오기!
    var sql = `SELECT gender FROM MEMB_tbl WHERE idx = ?`;
    var params = [memb_idx];
    var resultArr = await utils.queryResult(sql, params);
    var resultObj = resultArr[0];
    if (!resultObj) {
        res.send({
            code: 0,
            msg: `gender is null`,
        });
        return;
    }
    var gender = resultObj.gender;

    var sql = `
        SELECT 
            idx, 
            my_comment, 
            jongari, 
            akruk, 
            squat, 
            asm, 
            left_arm,
            right_arm,
            left_foot,
            right_foot,
            height1,
            created,
            modified
        FROM NEW_MUSCLE_CHECK_tbl 
        WHERE memb_idx = ? 
        ORDER BY created DESC, idx DESC
        LIMIT 1
    `;
    var params = [memb_idx];
    var resultArr = await utils.queryResult(sql, params);

    var resultObj = {
        code: 0,
    };

    // 각각의 측정 항목을 1,2,3 점으로 변환한다! 1: 미달, 2: 보통, 3: 양호
    for (obj of resultArr) {
        obj.code = 1;
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
    }

    if (resultArr[0]) {
        resultObj = resultArr[0];
    }

    res.send(resultObj);
});

router.get("/list/:memb_idx", setLog, async function (req, res, next) {
    const memb_idx = req.params.memb_idx;

    //성별가져오기!
    var sql = `SELECT gender FROM MEMB_tbl WHERE idx = ?`;
    var params = [memb_idx];
    var resultArr = await utils.queryResult(sql, params);
    var resultObj = resultArr[0];
    if (!resultObj) {
        res.send({
            code: 0,
            msg: `gender is null`,
        });
        return;
    }
    var gender = resultObj.gender;

    var sql = `
        SELECT 
            idx, 
            my_comment, 
            jongari, 
            akruk, 
            squat, 
            asm, 
            left_arm,
            right_arm,
            left_foot,
            right_foot,
            height1,
            created,
            modified
        FROM NEW_MUSCLE_CHECK_tbl 
        WHERE memb_idx = ? 
        ORDER BY created DESC, idx DESC
    `;
    var params = [memb_idx];
    var resultArr = await utils.queryResult(sql, params);

    // 각각의 측정 항목을 1,2,3 점으로 변환한다! 1: 미달, 2: 보통, 3: 양호
    for (obj of resultArr) {
        obj.code = 1;
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
    }
    res.send({
        code: 1,
        data: resultArr,
    });
});

router.post("/add", setLog, async function (req, res, next) {
    const { memb_idx, squat, akruk, jongari, left_arm, right_arm, left_foot, right_foot, height1, asm, squat_graph_json, created } = req.body;

    var calcAsm = 0;
    if (asm) {
        calcAsm = asm;
    } else {
        //asm 구하기!
        var calcAsm = (eval(left_arm) + eval(right_arm) + eval(left_foot) + eval(right_foot)) / Math.pow(eval(height1) / 100, 2);
        if (calcAsm) {
            calcAsm = calcAsm.toFixed(2);
        } else {
            calcAsm = "0.0";
        }
        //
    }

    const sql = `
        INSERT INTO NEW_MUSCLE_CHECK_tbl SET 
            memb_idx = ?,
            squat = ?,
            akruk = ?,
            jongari = ?,
            left_arm = ?,
            right_arm = ?,
            left_foot = ?,
            right_foot = ?,
            height1 = ?,
            asm = ?,
            squat_graph_json = ?,
            created = ?,
            modified = NOW()
        `;
    const params = [memb_idx, squat, akruk, jongari, left_arm, right_arm, left_foot, right_foot, height1, calcAsm, squat_graph_json, created];
    const resultArr = await utils.queryResult(sql, params);
    if (!resultArr) {
        resultObj.code = 0;
        resultObj.msg = `INSERT Error.`;
        res.json(resultObj);
        return;
    }
    res.json({ code: 1 });
});

router.get("/modify_value/:idx/:column/:value", setLog, async function (req, res, next) {
    const idx = req.params.idx;
    const column = req.params.column;
    const value = req.params.value;

    var sql = `UPDATE NEW_MUSCLE_CHECK_tbl SET ?? = ?, modified = NOW() WHERE idx = ?`;
    var params = [column, value, idx];
    var resultArr = await utils.queryResult(sql, params);
    if (!resultArr) {
        resultObj.code = 0;
        resultObj.msg = `UPDATE Error.`;
        res.send(resultObj);
        return;
    }

    sql = `SELECT * FROM NEW_MUSCLE_CHECK_tbl WHERE idx = ?`;
    params = [idx];
    var resultArr = await utils.queryResult(sql, params);
    var obj = resultArr[0];

    //성별가져오기!
    sql = `SELECT gender FROM MEMB_tbl WHERE idx = ?`;
    params = [obj.memb_idx];
    resultArr = await utils.queryResult(sql, params);
    var resultObj = resultArr[0];
    if (!resultObj) {
        res.send({
            code: 0,
            msg: `gender is null`,
        });
        return;
    }
    var gender = resultObj.gender;

    obj.code = 1;
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

    console.log(obj);

    res.send(obj);
});

router.post("/modify_asm_value", setLog, async function (req, res, next) {
    const { idx, left_arm, right_arm, left_foot, right_foot, height1, asm } = req.body;

    var calcAsm = 0;
    if (asm) {
        calcAsm = asm;
    } else {
        //asm 구하기!
        var calcAsm = (eval(left_arm) + eval(right_arm) + eval(left_foot) + eval(right_foot)) / Math.pow(eval(height1) / 100, 2);
        if (calcAsm) {
            calcAsm = calcAsm.toFixed(2);
        } else {
            calcAsm = "0.0";
        }
        //
    }

    var sql = `
        UPDATE NEW_MUSCLE_CHECK_tbl SET 
            left_arm = ?,
            right_arm = ?,
            left_foot = ?,
            right_foot = ?,
            height1 = ?,
            asm = ?,
            modified = NOW()
            WHERE idx = ?
        `;
    var params = [left_arm, right_arm, left_foot, right_foot, height1, calcAsm, idx];
    var resultArr = await utils.queryResult(sql, params);
    if (!resultArr) {
        resultObj.code = 0;
        resultObj.msg = `UPDATE Error.`;
        res.send(resultObj);
        return;
    }

    sql = `SELECT * FROM NEW_MUSCLE_CHECK_tbl WHERE idx = ?`;
    params = [idx];
    var resultArr = await utils.queryResult(sql, params);
    var obj = resultArr[0];

    //성별가져오기!
    sql = `SELECT gender FROM MEMB_tbl WHERE idx = ?`;
    params = [obj.memb_idx];
    resultArr = await utils.queryResult(sql, params);
    var resultObj = resultArr[0];
    if (!resultObj) {
        res.send({
            code: 0,
            msg: `gender is null`,
        });
        return;
    }
    var gender = resultObj.gender;

    if (!obj.asm) {
        obj.asm = 0;
    }

    obj.code = 1;
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

    console.log(obj);

    res.send(obj);
});

router.get("/get_data_by_month/:memb_idx/:year/:month", setLog, async function (req, res, next) {
    const memb_idx = req.params.memb_idx;
    const current_date = `${req.params.year}-${req.params.month}`;

    //성별가져오기!
    var sql = `SELECT gender FROM MEMB_tbl WHERE idx = ?`;
    var params = [memb_idx];
    var resultArr = await utils.queryResult(sql, params);
    var resultObj = resultArr[0];
    if (!resultObj) {
        res.send({
            code: 0,
            msg: `gender is null`,
        });
        return;
    }
    var gender = resultObj.gender;

    var sql = `
        SELECT 
            idx, 
            my_comment, 
            jongari, 
            akruk, 
            squat, 
            asm, 
            left_arm,
            right_arm,
            left_foot,
            right_foot,
            height1,
            created
        FROM NEW_MUSCLE_CHECK_tbl 
        WHERE memb_idx = ? 
        AND LEFT(created, 7) = ?
        AND created is not null 
        ORDER BY created ASC 
    `;
    var params = [memb_idx, current_date];
    var resultArr = await utils.queryResult(sql, params);

    var i = 0;

    // 각각의 측정 항목을 1,2,3 점으로 변환한다! 1: 미달, 2: 보통, 3: 양호
    for (obj of resultArr) {
        obj.seq = i;

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
    }
    res.send({
        code: 1,
        data: resultArr,
    });
});

router.get("/get_data_by_month_count/:memb_idx/:year/:month", setLog, async function (req, res, next) {
    const memb_idx = req.params.memb_idx;
    const current_date = `${req.params.year}-${req.params.month}`;

    //성별가져오기!
    var sql = `SELECT gender FROM MEMB_tbl WHERE idx = ?`;
    var params = [memb_idx];
    var resultArr = await utils.queryResult(sql, params);
    var resultObj = resultArr[0];
    if (!resultObj) {
        res.send({
            code: 0,
            msg: `gender is null`,
        });
        return;
    }
    var gender = resultObj.gender;

    sql = `
        SELECT 
            jongari, 
            akruk, 
            squat, 
            asm, 
            left_arm,
            right_arm,
            left_foot,
            right_foot,
            height1,
            created 
        FROM NEW_MUSCLE_CHECK_tbl 
        WHERE memb_idx = ? 
        AND LEFT(created, 7) = ?
        AND created is not null 
        ORDER BY created ASC
    `;
    resultArr = await utils.queryResult(sql, [memb_idx, current_date]);

    var tmp1, tmp2;
    var i = 0;
    for (obj of resultArr) {
        //날짜 분리
        tmp1 = obj.created.split(" ")[0];
        tmp2 = tmp1.split("-");

        obj.year = tmp2[0];
        obj.month = tmp2[1];
        obj.day = tmp2[2];

        obj.seq = i;

        var squat_point = gumjinPoint.getSquatPoint(obj.squat);
        var akruk_point = gumjinPoint.getAkrukPoint(gender, obj.akruk);
        var jongari_point = gumjinPoint.getJongariPoint(gender, obj.jongari);
        var asm_point = gumjinPoint.getASMPoint(gender, obj.asm);

        var pointSum = eval(squat_point) + eval(akruk_point);

        //ASM 있으면 asm 더한다!
        if (asm_point > 0) {
            pointSum += eval(asm_point);
        } else {
            pointSum += eval(jongari_point);
        }
        obj.point_sum = pointSum;

        i++;

        delete obj.created;
        delete obj.squat;
        delete obj.akruk;
        delete obj.jongari;
        delete obj.asm;
        delete obj.left_arm;
        delete obj.right_arm;
        delete obj.left_foot;
        delete obj.right_foot;
        delete obj.height1;
    }
    res.send(resultArr);
});

module.exports = router;
