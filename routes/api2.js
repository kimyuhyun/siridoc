const express = require("express");
const router = express.Router();
const fs = require("fs");
const db = require("../db");
const utils = require("../Utils");
const moment = require("moment");

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

router.get("/get_sarcf/:memb_idx", setLog, async (req, res, next) => {
    const { memb_idx } = req.params;

    const sql = `
        SELECT 
            created, 
            point1,
            point2,
            point3,
            point4,
            point5
        FROM SARC_F_tbl 
        WHERE memb_idx = ? 
        ORDER BY created DESC 
    `;
    const arr = await utils.queryResult(sql, [memb_idx]);
    for (const o of arr) {
        o.created = utils.utilConvertToMillis(o.created);
        o.ttl = eval(o.point1) + eval(o.point2) + eval(o.point3) + eval(o.point4) + eval(o.point5);
        delete o.point1;
        delete o.point2;
        delete o.point3;
        delete o.point4;
        delete o.point5;
    }
    res.send(arr);
});

router.post("/add_sarcf", setLog, async function (req, res, next) {
    const { memb_idx, point1, point2, point3, point4, point5 } = req.body;

    var sql = `
        INSERT INTO SARC_F_tbl SET
            memb_idx = ?, 
            point1 = ?, 
            point2 = ?, 
            point3 = ?, 
            point4 = ?, 
            point5 = ?,
            created = NOW(),
            modified = NOW()
    `;
    var params = [memb_idx, point1, point2, point3, point4, point5];
    var resultArr = await utils.queryResult(sql, params);

    //포인트 계산
    var ttl = eval(point1) + eval(point2) + eval(point3) + eval(point4) + eval(point5);
    console.log(ttl);
    // 0 ~ 3 고위험도
    // 4 ~ 6 중위험도
    // 7 ~ 10 저위험도
    res.send({
        ttl: ttl,
    });
});

router.get("/get_h_w_list/:memb_idx", setLog, async function (req, res, next) {
    const memb_idx = req.params.memb_idx;

    var sql = `
        SELECT Z.* FROM (
            SELECT * FROM BODY_tbl WHERE memb_idx = ? ORDER BY created DESC LIMIT 100
        ) as Z
        GROUP BY wdate ORDER BY wdate DESC
    `;
    var params = [memb_idx];
    var resultArr = await utils.queryResult(sql, params);
    res.send(resultArr);
});

module.exports = router;
