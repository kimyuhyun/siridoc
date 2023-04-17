const express = require("express");
const router = express.Router();
const db = require("../db");
const aes256util = require("../AES256Util");
const utils = require("../Utils");

async function checkToken(req, res, next) {
    console.log(req.query.token);
    if (!req.query.token) {
        res.send({
            code: 0,
            msg: "token is empty",
        });
        return;
    }

    const after10s = Math.floor(new Date().getTime()) - 10000;
    const token = eval(aes256util.decrypt(req.query.token));
    if (!token) {
        res.send({
            code: 0,
            msg: "token is invalid",
        });
        return;
    }
    console.log(after10s, token);
    if (token < after10s) {
        res.send({
            code: 0,
            msg: "token is expired",
            // msg: `${moment(new Date(token)).format('YY-MM-DD HH:mm:ss')} : ${moment(new Date(after10s)).format('YY-MM-DD HH:mm:ss')}`
        });
        return;
    }
    next();
}
router.get("/", checkToken, async function (req, res, next) {
    res.send("join");
});

router.post("/write", checkToken, async function (req, res, next) {
    const table = req.body.table;
    const idx = req.body.idx;

    delete req.body.idx;
    delete req.body.table;
    // delete req.body.created;
    // delete req.body.modified;

    var sql = ``;
    var records = [];
    records.push(table);

    for (key in req.body) {
        if (req.body[key] != "null") {
            if (key == "pass1") {
                if (req.body[key]) {
                    sql += key + "= PASSWORD(?), ";
                    records.push(req.body[key]);
                }
            } else {
                sql += key + "= ?, ";
                records.push(req.body[key]);
            }
        }
    }

    if (idx) {
        records.push(idx);
        sql = `UPDATE ?? SET ${sql} modified = NOW() WHERE idx = ?`;
        var rs = await utils.queryResult(sql, records);
        rs.code = 1;
        rs.msg = "수정되었습니다.";
        res.send(rs);
    } else {
        console.log(records);
        if (req.body.created) {
            sql = `INSERT INTO ?? SET ${sql.slice(0, -2)}`;
        } else {
            sql = `INSERT INTO ?? SET ${sql} created = NOW(), modified = NOW()`;
        }
        var rs = await utils.queryResult(sql, records);
        rs.code = 1;
        rs.msg = "등록되었습니다.";
        res.send(rs);
    }
});

router.post("/delete", checkToken, async function (req, res, next) {
    const table = req.body.table;
    const idx = req.body.idx;
    const sql = `DELETE FROM ?? WHERE idx = ?`;
    const params = [table, idx];
    var rs = await utils.queryResult(sql, params);
    rs.code = 1;
    rs.msg = "삭제되었습니다.";
    res.send(rs);
});

module.exports = router;
