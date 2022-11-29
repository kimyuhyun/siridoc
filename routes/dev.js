const express = require('express');
const router = express.Router();
const fs = require('fs');
const db = require('../db');
const utils = require('../Utils');
const moment = require('moment');
const menus = require('../menu');

global.menus = menus;
global.showMenuLinkArr;

async function checking(req, res, next) {
    if (!req.session.mid) {
        res.redirect('/adm/login');
        return;
    }

    var sql = `SELECT show_menu_link FROM GRADE_tbl WHERE level1 = ?`;
    var params = [req.session.level1];
    var arr = await utils.queryResult(sql, params);
    console.log(arr[0].show_menu_link);
    if (arr) {
        global.showMenuLinkArr = arr[0].show_menu_link.substr(1, 9999).split(',');
    }
    next();
}

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



router.get('/', setLog, async function(req, res, next) {

    // var sql = ``;
    // var params = [];
    // var arr = await utils.queryResult(sql, params);
    // console.log(arr);

    res.send('api');
});



module.exports = router;
