const express = require('express');
const router = express.Router();
const db = require('../db');
const utils = require('../Utils');
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
        console.log(showMenuLinkArr);
    }
    next();
}

router.get('/', checking, function(req, res, next) {
    res.render('./adm/main.html', {
        myinfo: req.session,
        menu1: null,
        menu2: null,
    });

});


router.get('/login', function(req, res, next) {
    res.render('./adm/login.html', {
        year: new Date().getFullYear(),
        id: req.cookies['id'],
        pw: req.cookies['pw'],
    });
});

router.post('/login', async function(req, res, next) {
    var sql = `SELECT idx, id, name1, level1, filename0 FROM MEMB_tbl WHERE id = ? AND pass1 = PASSWORD(?)`;
    var params = [req.body.id, req.body.pw];
    var arr = await utils.queryResult(sql, params);
    var obj = arr[0];

    if (!obj) {
        res.send('<script type="text/javascript">alert("아이디/패스워드가 일치 하지 않습니다.");history.back();</script>');
        return;
    }

    if (obj.level1 > 2) {
        res.send('<script type="text/javascript">alert("접근권한이 없습니다.");history.back();</script>');
        return;
    }

    req.session.idx = obj.idx;
    req.session.mid = obj.id;
    req.session.name1 = obj.name1;
    req.session.level1 = obj.level1;
    req.session.filename0 = obj.filename0;

    if (req.body.remember == 1) {
        res.cookie('id', obj.id, {
            maxAge: 60 * 60 * 1000,
            httpOnly: true,
            path: '/'
        });
        res.cookie('pw', req.body.pw, {
            maxAge: 60 * 60 * 1000,
            httpOnly: true,
            path: '/'
        });
    } else {
        res.clearCookie('id', {
            path: '/'
        });
        res.clearCookie('pw', {
            path: '/'
        });
    }

    // db.query("UPDATE MEMB_tbl SET modified = NOW() WHERE id = ?", obj.id);

    req.session.save(function() {
        console.log('로그인성공');
        res.redirect('/adm');
    });

});

router.get('/logout', function(req, res, next) {
    req.session.destroy(function() {
        res.clearCookie('sid');
        res.send('<script type="text/javascript">alert("로그아웃 되었습니다.");location.href="/adm/login"</script>');
    });
});


router.get('/codes/:menu1/:menu2', checking, async function(req, res, next) {
    var step2Arr = [];
    var step3Arr = [];
    var step4Arr = [];
    var arr = [];

    var sql = `SELECT CONCAT(idx, '||',sort1) as data, code1 as id, name1 as text FROM CODES_tbl WHERE LENGTH(code1) = 2 ORDER BY sort1 DESC`;
    var arr = await utils.queryResult(sql, []);
    for (var step1 of arr) {
        sql = `SELECT  CONCAT(idx, '||',sort1) as data, code1 as id, name1 as text FROM CODES_tbl WHERE LEFT(code1, 2) = ? AND LENGTH(code1) = 4 ORDER BY sort1 DESC`;
        step2Arr = await utils.queryResult(sql, [step1.id]);
        
        step1.children = [];

        for (step2 of step2Arr) {
            sql = `SELECT  CONCAT(idx, '||',sort1) as data, code1 as id, name1 as text FROM CODES_tbl WHERE LEFT(code1, 4) = ? AND LENGTH(code1) = 6 ORDER BY sort1 DESC`;
            step3Arr = await utils.queryResult(sql, [step2.id]);

            step2.children = [];

            for (step3 of step3Arr) {
                sql = `SELECT  CONCAT(idx, '||',sort1) as data, code1 as id, name1 as text FROM CODES_tbl WHERE LEFT(code1, 6) = ? AND LENGTH(code1) = 8 ORDER BY sort1 DESC`;
                step4Arr = await utils.queryResult(sql, [step3.id]);

                step3.children = [];

                for (step4 of step4Arr) {
                    step3.children.push(step4);
                }

                step2.children.push(step3);
            }
            
            step1.children.push(step2);
        }
    }

    res.render('./adm/codes.html', {
        myinfo: req.session,
        menu1: req.params.menu1,
        menu2: req.params.menu2,
        data: {
            id: 'root',
            text: '코드',
            children: arr,
        },
    });
});


router.get('/board/:board_id/:page/:menu1/:menu2', checking, async function(req, res, next) {
    var { board_id, page, menu1, menu2 } = req.params;
    var search = req.query.search;
    var orderby = req.query.orderby;

    var where = ` WHERE STEP = 1 AND is_use = 1 `;
    var records = [];
    
    if (board_id) {
        where += ` AND board_id = ? `;
        records.push(board_id);
    }

    if (search) {
        where += ` AND (title LIKE ? OR memo LIKE ?) `;
        records.push(`%${search}%`);
        records.push(`%${search}%`);
    } else {
        search = '';
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

    var sql = `SELECT COUNT(*) as cnt FROM BOARD_tbl ${where}`;
    var arr = await utils.queryResult(sql, records);

    const pageHeler = utils.pageHelper(page, arr[0].cnt);

    records.push(pageHeler.skipSize);
    records.push(pageHeler.contentSize);

    sql = `
        SELECT 
        A.*, 
        (SELECT COUNT(*) FROM BOARD_tbl WHERE parent_idx = A.idx) as reply_cnt
        FROM BOARD_tbl as A
        ${where} 
        ORDER BY ${orderby}
        LIMIT ?, ?
    `;
    arr = await utils.queryResult(sql, records);
    // if (!arr.length) {
    //     res.send('Error');
    //     return;
    // }

    console.log(sql, records);
    var list = [];
    for (row of arr) {
        row.created = utils.utilConvertToMillis(row.created);
        row.modified = utils.utilConvertToMillis(row.modified);
        list.push(row);
    }

    var data = pageHeler;
    data.board_id = board_id;
    data.orderby = orderby;
    data.search = search;
    data.list = list;

    res.render(`./adm/${board_id}.html`, {
        myinfo: req.session,
        menu1: req.params.menu1,
        menu2: req.params.menu2,
        data,
    });
});


//댓글 가져오기!
router.get('/board/reply/:parent_idx', checking, async function(req, res, next) {
    const parent_idx = req.params.parent_idx;
    var sql = `SELECT idx, name1, memo, step FROM BOARD_tbl WHERE parent_idx = ? AND STEP = 2 ORDER BY idx ASC`;
    var arr = await utils.queryResult(sql, [parent_idx]);

    var arr2 = [];
    for (row of arr) {
        arr2.push(row);

        sql = `SELECT idx, name1, memo, step FROM BOARD_tbl WHERE parent_idx = ? AND STEP = 3 ORDER BY idx ASC`;
        tmpArr = await utils.queryResult(sql, [row.idx]);

        for (row2 of tmpArr) {
            arr2.push(row2);
        }
    }


    var reply = [];
    for (row of arr2) {
        row.created = utils.utilConvertToMillis(row.created);
        row.modified = utils.utilConvertToMillis(row.modified);

        reply.push(row);
    }
    res.send(reply);
});


router.get('/grade/:menu1/:menu2', checking, async function(req, res, next) {
    const { menu1, menu2 } = req.params;

    const sql = ` SELECT * FROM GRADE_tbl ORDER BY level1 ASC `;
    var arr = await utils.queryResult(sql, []);

    var list = [];
    for (row of arr) {
        row.created = utils.utilConvertToMillis(row.created);
        row.modified = utils.utilConvertToMillis(row.modified);
        list.push(row);
    }
    
    res.render('./adm/grade.html', {
        myinfo: req.session,
        menu1,
        menu2,
        list
    });

});


router.get('/manager/:page/:menu1/:menu2', checking, async function(req, res, next) {
    var { page, menu1, menu2 } = req.params;
    var search = req.query.search;
    var orderby = req.query.orderby;

    var where = ` WHERE level1 = 2 `;
    var records = [];

    if (search) {
        where += ` AND (id LIKE ? OR name1 LIKE ?) `;
        records.push(`%${search}%`);
        records.push(`%${search}%`);
    } else {
        search = '';
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

    var sql = `SELECT COUNT(*) as cnt FROM MEMB_tbl ${where}`;
    var arr = await utils.queryResult(sql, records);

    const pageHeler = utils.pageHelper(page, arr[0].cnt);

    records.push(pageHeler.skipSize);
    records.push(pageHeler.contentSize);

    sql = ` SELECT * FROM MEMB_tbl ${where} ORDER BY ${orderby} LIMIT ?, ? `;
    arr = await utils.queryResult(sql, records);

    var list = [];
    for (row of arr) {
        row.created = utils.utilConvertToMillis(row.created);
        row.modified = utils.utilConvertToMillis(row.modified);
        list.push(row);
    }
    
    var data = pageHeler;
    data.orderby = orderby;
    data.search = search;
    data.list = list;

    res.render(`./adm/manager.html`, {
        myinfo: req.session,
        menu1: req.params.menu1,
        menu2: req.params.menu2,
        data,
    });

});


router.get('/user/:page/:menu1/:menu2', checking, async function(req, res, next) {
    var { page, menu1, menu2 } = req.params;
    var search = req.query.search;
    var orderby = req.query.orderby;

    var where = ` WHERE level1 = 9 `;
    var records = [];

    if (search) {
        where += ` AND (id LIKE ? OR name1 LIKE ?) `;
        records.push(`%${search}%`);
        records.push(`%${search}%`);
    } else {
        search = '';
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

    var sql = `SELECT COUNT(*) as cnt FROM MEMB_tbl ${where}`;
    var arr = await utils.queryResult(sql, records);

    const pageHeler = utils.pageHelper(page, arr[0].cnt);

    records.push(pageHeler.skipSize);
    records.push(pageHeler.contentSize);

    sql = ` SELECT * FROM MEMB_tbl ${where} ORDER BY ${orderby} LIMIT ?, ? `;
    arr = await utils.queryResult(sql, records);

    var list = [];
    for (row of arr) {
        row.created = utils.utilConvertToMillis(row.created);
        row.modified = utils.utilConvertToMillis(row.modified);
        list.push(row);
    }
    
    var data = pageHeler;
    data.orderby = orderby;
    data.search = search;
    data.list = list;

    res.render(`./adm/user.html`, {
        myinfo: req.session,
        menu1: req.params.menu1,
        menu2: req.params.menu2,
        data,
    });

});

module.exports = router;
