const express = require('express');
const router = express.Router();
const fs = require('fs')
const db = require('../db');
const utils = require('../Utils');
const FormData = require('form-data');
const axios = require('axios');
const path = require('path');
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

router.get('/list/:view/:menu1/:menu2', checking, async function(req, res, next) {
    var { view, menu1, menu2 } = req.params;
    var { table, page, search_column, search_value, orderby } = req.query;
    
    var where = `WHERE 1=1 `;

    var records = [];
    records.push(table);

    for (key in req.session.my_params) {
        where += ` AND ${key} = ? `;
        records.push(req.session.my_params[key]);
    }
    
    if (search_column && search_value) {
        where += ` AND ?? LIKE ? `;
        records.push(search_column);
        records.push(`%${search_value}%`);
    } else {
        search_column = '';
        search_value = '';
    }

    if (orderby) {
        if (orderby.toLowerCase().includes('delete') || orderby.toLowerCase().includes('update') || orderby.toLowerCase().includes('select')) {
            console.log('err', orderby);
            res.send(orderby);
            return;
        }
    } else {
        orderby = ' idx DESC ';
    }

    var sql = `SELECT COUNT(*) as cnt FROM ?? ${where}`;
    var arr = await utils.queryResult(sql, records);
    console.log(sql, records, arr);

    const pageHeler = utils.pageHelper(page, arr[0].cnt);

    records.push(pageHeler.skipSize);
    records.push(pageHeler.contentSize);

    sql = `
        SELECT 
        * 
        FROM ?? 
        ${where} 
        ORDER BY ${orderby}
        LIMIT ?, ?
    `;
    arr = await utils.queryResult(sql, records);
    // console.log(sql, records, arr);

    var list = [];
    for (row of arr) {
        row.created = utils.utilConvertToMillis(row.created);
        row.modified = utils.utilConvertToMillis(row.modified);
        list.push(row);
    }

    var data = pageHeler;
    data.table = table;
    data.view = view;
    data.orderby = orderby;
    data.search_column = search_column;
    data.search_value = search_value;
    data.list = list;

    res.render(`./adm/${view}.html`, {
        myinfo: req.session,
        menu1: req.params.menu1,
        menu2: req.params.menu2,
        data,
    });
});


router.get('/write', checking, async function(req, res, next) {
    var { idx, return_url, table, view } = req.query;
    
    var row = {};
    
    if (idx) {
        var sql = `SELECT * FROM ?? WHERE idx = ?`;
        var params = [table, idx];
        var arr = await utils.queryResult(sql, params);
        row = arr[0];
        console.log(sql, params);
    }

    if (req.session.my_params.board_id) {
        row.board_id = req.session.my_params.board_id;
    }

    
    res.render(`./adm/${view}_write.html`, {
        myinfo: req.session,
        return_url,
        table,
        row,
    });
});

router.post('/write', checking, async function(req, res, next) {
    const table = req.query.table;
    const return_url = req.body.return_url;
    const idx = req.body.idx;
    delete req.body.idx;
    delete req.body.return_url;
    
    var isDateColnumn = true;

    //날짜 컬럼이 있는지 확인!
    var sql = `SHOW COLUMNS FROM ?? LIKE 'created'`;
    var arr = await utils.queryResult(sql, [table]);
    if (!arr[0]) {
        isDateColnumn = false;
    }
    
    sql = '';
    var records = [];
    records.push(table);

    for (key in req.body) {
        if (req.body[key] != 'null') {
            if (key == 'pass1') {
                if (req.body[key]) {
                    sql += key + '= PASSWORD(?), ';
                    records.push(req.body[key]);
                }
            } else {
                sql += key + '= ?, ';
                records.push(req.body[key]);
            }
        }
    }

    if (idx) {
        records.push(idx);
        if (isDateColnumn) {
            sql = `UPDATE ?? SET ${sql} modified = NOW() WHERE idx = ?`;
        } else {
            sql = `UPDATE ?? SET ${sql.slice(0, -2)}  WHERE idx = ?`;
        }
    } else {
        if (isDateColnumn) {
            sql = `INSERT INTO ?? SET ${sql} created = NOW(), modified = NOW()`;
        } else {
            sql = `INSERT INTO ?? SET ${sql.slice(0, -2)}`;
        }
    }

    console.log(`@@@@ ${sql}`, records);

    var rs = await utils.queryResult(sql, records);

    console.log(rs);

    if (return_url) {
        res.redirect(return_url);
    } else {
        res.send(rs);
    }
});


router.get('/iterator', checking, async function(req, res, next) {
    const table = req.query.table;
    const sort1 = req.query.sort1;

    var sql = ` SELECT * FROM ?? ORDER BY ? `;
    var arr = await utils.queryResult(sql, [table, sort1]);
    res.send(arr);
});

router.get('/delete', checking, async function(req, res, next) {
    const return_url = req.query.return_url;
    const table = req.query.table;
    const idxArr = req.query.idx;

    console.log(idxArr.length);
    
    for (idx of idxArr) {
        console.log(table, idx);
        db.query(`DELETE FROM ?? WHERE idx = ?`, [table, idx]);
    }

    if (return_url) {
        res.redirect(return_url);
    } else {
        res.send('1');
    }
});

router.post('/link_upload', async function(req, res, next) {
    const urlLink = req.body.url_link;
    console.log(urlLink);
    var imageResponse = await axios({
        url: urlLink,
        method: 'GET',
        responseType: 'arraybuffer'
    });
    var extension = path.extname(urlLink);
    extension = extension.split('?')[0];
    
    //Create form data
    const form = new FormData();
    form.append('upload_file', imageResponse.data, {
        contentType: `image/${extension}`,
        name: `image`,
        filename: `imageFileName.${extension}`
    });
    
    //Submit form
    const result = await axios({
        url: `${process.env.HOST_NAME}/file_upload/file_upload`, 
        method: 'POST',
        data: form, 
        headers: { "Content-Type": `multipart/form-data; boundary=${form._boundary}` }
    });
    res.send(result.data);
});

router.get('/set_params_session', async function(req, res, next) {
    if (req.query) {
        var obj = {};
        for (key in req.query) {
            if (key != 'table') {
                obj[key] = req.query[key];
            }
        }
        req.session.my_params = obj;
    } else {
        req.session.my_params = {};
    }
    req.session.save();
    res.send(true);
});



module.exports = router;
