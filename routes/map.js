const express = require('express');
const router = express.Router();
const fs = require('fs');
const db = require('../db');
const utils = require('../Utils');
const moment = require('moment');


router.get('/get_hospital', async function(req, res, next) {
    const my_lat = req.query.my_lat;
    const my_lng = req.query.my_lng;
    const lat1 = req.query.lat1;
    const lat2 = req.query.lat2;
    const lng1 = req.query.lng1;
    const lng2 = req.query.lng2;

    var sql = `
        SELECT * FROM (
            SELECT
            A.idx,
            A.name1,
            A.addr,
            A.grade,
            A.tel,
            A.lat,
            A.lng,
            (6371*acos(cos(radians(` + my_lat + `))*cos(radians(lat))*cos(radians(lng)-radians(` + my_lng + `))+sin(radians(` + my_lat + `))*sin(radians(lat)))) AS distance
        FROM HOSPITAL_tbl as A) as Z
        WHERE lat >= ? AND lng >= ? AND lat <= ? AND lng <= ?
        ORDER BY distance ASC 
    `;
    var params = [lat1,lng1,lat2,lng2];
    var resultArr = await utils.queryResult(sql, params);
    
    res.send(resultArr);
});



module.exports = router;
