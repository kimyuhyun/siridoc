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
    if (arr) {
        global.showMenuLinkArr = arr[0].show_menu_link.substr(1, 9999).split(',');
    }
    next();
}

router.get('/list/:view/:menu1/:menu2', checking, async function(req, res, next) {
    var view = req.params.view;
    var { table, page, search_column, search_value, orderby } = req.query;
    
    var where = ` WHERE level1 = 9 AND name1 != '' `;

    var records = [];
    records.push(table);

    for (key in req.session.my_params) {
        where += ` AND ${key} = ? `;
        records.push(req.session.my_params[key]);
    }

    where += ` AND dct_id = ? `;
    records.push(req.session.mid);
    
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
    console.log(sql, records);

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
    
    var sql = `SELECT * FROM ?? WHERE idx = ?`;
    var params = [table, idx];
    var arr = await utils.queryResult(sql, params);
    row = arr[0];
    
    sql = `SELECT * FROM NEW_MUSCLE_CHECK_tbl WHERE memb_idx = ? ORDER BY created DESC, idx DESC`;
    arr = await utils.queryResult(sql, [row.idx]);
    
    res.render(`./adm/${view}_write.html`, {
        myinfo: req.session,
        return_url,
        table,
        row,
        arr,
    });




});

module.exports = router;
