const express = require("express");
const router = express.Router();
const fs = require("fs");
const db = require("../db");
const utils = require("../Utils");
const moment = require("moment");

router.get("/get_hospital", async function (req, res, next) {
    const my_lat = req.query.my_lat;
    const my_lng = req.query.my_lng;
    const lat1 = req.query.lat1;
    const lat2 = req.query.lat2;
    const lng1 = req.query.lng1;
    const lng2 = req.query.lng2;

    const sql = `
        SELECT * FROM (
            SELECT
            A.idx,
            A.name1,
            A.addr,
            A.grade,
            A.tel,
            A.lat,
            A.lng,
            (6371*acos(cos(radians(${my_lat}))*cos(radians(lat))*cos(radians(lng)-radians(${my_lng}))+sin(radians(${my_lat}))*sin(radians(lat)))) AS distance
        FROM HOSPITAL_tbl as A) as Z
        WHERE lat >= ? AND lng >= ? AND lat <= ? AND lng <= ?
        ORDER BY distance ASC 
    `;
    var params = [lat1, lng1, lat2, lng2];
    var resultArr = await utils.queryResult(sql, params);

    res.send(resultArr);
});

router.get("/get_hospital_search", async function (req, res, next) {
    const q = `%${req.query.query}%`;
    const my_lat = req.query.my_lat;
    const my_lng = req.query.my_lng;
    
    const sql = `
        SELECT * FROM (
            SELECT
            A.idx,
            A.name1,
            A.addr,
            A.grade,
            A.tel,
            A.lat,
            A.lng,
            (6371*acos(cos(radians(?))*cos(radians(lat))*cos(radians(lng)-radians(?))+sin(radians(?))*sin(radians(lat)))) AS distance
        FROM HOSPITAL_tbl as A) as Z
        WHERE (name1 LIKE ? OR addr LIKE ?)
        ORDER BY distance ASC 
        LIMIT 0, 50
    `;
    var params = [my_lat, my_lng, my_lat, q, q];
    var resultArr = await utils.queryResult(sql, params);

    res.send(resultArr);
});

router.get("/get_hospital/:idx/:memb_id", async function (req, res, next) {
    const idx = req.params.idx;
    const memb_id = req.params.memb_id;
    const sql = `
        SELECT 
            A.idx,
            A.name1,
            A.addr,
            A.tel,
            A.lat,
            A.lng,
            (SELECT count(*) FROM HOSPITAL_FAV_tbl WHERE hospital_idx = A.idx AND memb_id = ?) as is_fav
        FROM HOSPITAL_tbl as A
        WHERE idx = ?
    `;
    const arr = await utils.queryResult(sql, [memb_id, idx]);
    const obj = arr[0];

    res.send(obj);
});

router.get("/set_hospital_fav/:idx/:memb_id", async function (req, res, next) {
    const idx = req.params.idx;
    const memb_id = req.params.memb_id;
    var sql = `SELECT count(*) as cnt FROM HOSPITAL_FAV_tbl WHERE hospital_idx = ? AND memb_id = ?`;
    var arr = await utils.queryResult(sql, [idx, memb_id]);
    var obj = arr[0];
    if (obj.cnt == 0) {
        sql = `INSERT INTO HOSPITAL_FAV_tbl SET hospital_idx = ?, memb_id = ?`;
        const result = await utils.queryResult(sql, [idx, memb_id]);
        res.send({
            result,
            is_fav: 1,
        });
    } else {
        sql = `DELETE FROM HOSPITAL_FAV_tbl WHERE hospital_idx = ? AND memb_id = ?`;
        const result = await utils.queryResult(sql, [idx, memb_id]);
        res.send({
            result,
            is_fav: 0,
        });
    }
});

module.exports = router;
