const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const fs = require('fs');
const db = require('../db');
const utils = require('../Utils');
const jwt = require('../jwt-util');
const moment = require('moment');


async function setLog(req, res, next) {
    // const token = req.headers.authorization.split('Bearer ')[1]; // header에서 access token을 가져옵니다.
    // const result = jwt.verify(token); // token을 검증합니다.
    // if (!result.ok) {   // 검증에 실패하거나 토큰이 만료되었다면 클라이언트에게 메세지를 담아서 응답합니다.
    //     res.send({
    //         code: 0,
    //         msg: result.message,
    //     });
    //     return;
    // }

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
    await utils.queryResult(sql, params);
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

router.get('/list', setLog, async function(req, res, next) {
    const board_id = req.query.board_id;
    const id = req.query.id;

    var page = req.query.page;
    page = page * 20;

    var arr = [];
    arr.push(board_id);

    await new Promise(function(resolve, reject) {
        var sql = `
            SELECT
            A.idx,
            A.board_id,
            A.id,
            A.title,
            A.memo,
            A.name1,
            A.filename0,
            A.filename1,
            A.filename2,
            A.filename3,
            A.filename4,
            A.filename5,
            A.filename6,
            A.filename7,
            A.filename8,
            A.filename9,
            A.created,
            (SELECT COUNT(*) FROM BOARD_tbl WHERE parent_idx = A.idx AND step = 2) as reply_cnt,
            (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE board_idx = A.idx) as like1,
            (SELECT COUNT(*) FROM BOARD_SEE_tbl WHERE board_idx = A.idx) as see,
            (SELECT filename0 FROM MEMB_tbl WHERE id = A.id) as user_thumb
            FROM
            BOARD_tbl as A
            WHERE step = 1
            AND is_use = 1
            AND board_id = ? `;
        if (id != '') {
            sql += ` AND id = ? `;
            arr.push(id);
        }

        sql += ` ORDER BY idx DESC `;
        sql += ` LIMIT ${page}, 20 `;

        db.query(sql, arr, function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                resolve(err);
            }
        });
    }).then(function(data) {
        arr = data;
    });

    res.send(arr);
});

router.get('/list/:idx/:id', setLog, async function(req, res, next) {
    const idx = req.params.idx;
    const id = req.params.id;
    var obj = {};

    //조회수 업데이트
    await new Promise(function(resolve, reject) {
        db.query("SELECT COUNT(*) as cnt FROM BOARD_SEE_tbl WHERE id = ? AND board_idx = ?", [id, idx], function(err, rows, fields) {
            if (!err) {
                if (rows[0].cnt == 0) {
                    db.query("INSERT INTO BOARD_SEE_tbl SET id = ?, board_idx = ?", [id, idx]);
                }

                resolve();
            } else {
                console.log(err);
            }
        });
    }).then();
    //

    await new Promise(function(resolve, reject) {
        const sql = `
            SELECT
            A.*,
            (SELECT COUNT(*) FROM BOARD_SEE_tbl WHERE board_idx = A.idx) as see,
            (SELECT COUNT(*) FROM BOARD_tbl WHERE parent_idx = A.idx AND step = 2) as reply_cnt,
            (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE board_idx = A.idx) as like1,
            (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE board_idx = A.idx AND id = ?) as is_like1,
            (SELECT filename0 FROM MEMB_tbl WHERE id = A.id) as user_thumb
            FROM
            BOARD_tbl as A
            WHERE idx = ?
            ORDER BY idx DESC
        `;
        db.query(sql, [id, idx], function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                resolve(err);
            }
        });
    }).then(function(data) {
        obj = data;

    });
    res.send(obj);
});

router.get('/reply/:idx/:id/:is_like1_sort', setLog, async function(req, res, next) {
    const idx = req.params.idx;
    const id = req.params.id;
    const is_like1_sort = req.params.is_like1_sort;

    var arr = [];
    var tmpArr = [];

    await new Promise(function(resolve, reject) {
        var sql = `
            SELECT
            A.idx,
            A.parent_idx,
            A.board_id,
            A.id,
            A.name1,
            A.step,
            A.memo,
            A.filename0,
            A.created,
            (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE board_idx = A.idx) as like1_cnt,
            (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE board_idx = A.idx AND id = ?) as is_like1,
            (SELECT COUNT(*) FROM BOARD_tbl WHERE parent_idx = A.idx AND step = 3) as reply_cnt,
            (SELECT filename0 FROM MEMB_tbl WHERE id = A.id) as user_thumb
            FROM BOARD_tbl as A
            WHERE A.step = 2
            AND A.parent_idx = ? `;
        if (is_like1_sort == 1) {
            sql += `ORDER BY like1_cnt DESC`;
        } else {
            sql += `ORDER BY A.idx ASC`;
        }
        db.query(sql, [id, idx], function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                resolve(err);
            }
        });
    }).then(function(data) {
        var tmpRows = data;
        var i = 0;
        for (obj of tmpRows) {
            i++;
            obj.groups = i;

            tmpArr.push(obj);
        }
    });

    for (obj of tmpArr) {
        arr.push(obj);

        await new Promise(function(resolve, reject) {
            var sql = `
                SELECT
                A.idx,
                A.parent_idx,
                A.board_id,
                A.id,
                A.name1,
                A.step,
                A.memo,
                A.filename0,
                A.created,
                (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE board_idx = A.idx) as like1_cnt,
                (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE board_idx = A.idx AND id = ?) as is_like1,
                (SELECT filename0 FROM MEMB_tbl WHERE id = A.id) as user_thumb,
                0 as reply_cnt
                FROM BOARD_tbl as A
                WHERE A.step = 3
                AND A.parent_idx = ?
                ORDER BY A.idx ASC
            `;
            db.query(sql, [id, obj.idx], function(err, rows, fields) {
                // console.log(rows);
                if (!err) {
                    resolve(rows);
                } else {
                    console.log(err);
                    resolve(err);
                }
            });
        }).then(function(data) {
            for (obj2 of data) {
                obj2.groups = obj.groups;
                arr.push(obj2);
            }
        });
    }
    res.send(utils.nvl(arr));
});

router.get('/re_reply/:idx/:id', setLog, async function(req, res, next) {
    const idx = req.params.idx;
    const id = req.params.id;

    var arr = [];
    var tmpArr = [];

    await new Promise(function(resolve, reject) {
        var sql = `
            SELECT
            A.idx,
            A.parent_idx,
            A.board_id,
            A.id,
            A.name1,
            A.step,
            A.memo,
            A.filename0,
            A.created,
            (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE board_idx = A.idx) as like1_cnt,
            (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE board_idx = A.idx AND id = ?) as is_like1,
            (SELECT COUNT(*) FROM BOARD_tbl WHERE parent_idx = A.idx AND step = 3) as reply_cnt,
            (SELECT filename0 FROM MEMB_tbl WHERE id = A.id) as user_thumb
            FROM BOARD_tbl as A
            WHERE A.step = 2
            AND A.idx = ?
            ORDER BY A.idx ASC
        `;
        db.query(sql, [id, idx], function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        var tmpRows = data;
        var i = 0;
        for (obj of tmpRows) {
            i++;
            obj.groups = i;
            tmpArr.push(obj);
        }
    });

    for (obj of tmpArr) {
        arr.push(obj);

        await new Promise(function(resolve, reject) {
            var sql = `
                SELECT
                A.idx,
                A.parent_idx,
                A.board_id,
                A.id,
                A.name1,
                A.step,
                A.memo,
                A.filename0,
                A.created,
                (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE board_idx = A.idx) as like1_cnt,
                (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE board_idx = A.idx AND id = ?) as is_like1,
                (SELECT filename0 FROM MEMB_tbl WHERE id = A.id) as user_thumb,
                0 as reply_cnt
                FROM BOARD_tbl as A
                WHERE A.step = 3
                AND A.parent_idx = ?
                ORDER BY A.idx ASC
            `;
            db.query(sql, [id, obj.idx], function(err, rows, fields) {
                // console.log(rows);
                if (!err) {
                    resolve(rows);
                } else {
                    console.log(err);
                    resolve(err);
                }
            });
        }).then(function(data) {
            for (obj2 of data) {
                obj2.groups = obj.groups;
                arr.push(obj2);
            }
        });
    }
    res.send(arr);
});

router.get('/set_like1/:idx/:id', setLog, async function(req, res, next) {
    const idx = req.params.idx;
    const id = req.params.id;
    var cnt = 0;
    var arr = {};

    await new Promise(function(resolve, reject) {
        var sql = `SELECT COUNT(*) as CNT FROM BOARD_LIKE_tbl WHERE board_idx = ? AND id = ?`;
        db.query(sql, [idx, id], function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        cnt = data.CNT;
    });

    var sql = '';
    if (cnt == 0) {
        sql = `INSERT INTO BOARD_LIKE_tbl SET board_idx = ?, id = ?`;
    } else {
        sql = `DELETE FROM BOARD_LIKE_tbl WHERE board_idx = ? AND id = ?`;
    }

    await new Promise(function(resolve, reject) {
        db.query(sql, [idx, id], function(err, rows, fields) {
            if (!err) {
                sql = `SELECT COUNT(*) as CNT FROM BOARD_LIKE_tbl WHERE board_idx = ?`;
                db.query(sql, idx, function(err, rows, fields) {
                    if (!err) {
                        resolve(rows[0]);
                    } else {
                        console.log(err);
                    }
                });
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        arr.cnt = data.CNT;
    });

    await new Promise(function(resolve, reject) {
        var sql = `SELECT COUNT(*) as CNT FROM BOARD_LIKE_tbl WHERE board_idx = ? AND id = ?`;
        db.query(sql, [idx, id], function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        arr.is_me = data.CNT;
    });
    res.send(arr);
});

router.post('/id_pass_confirm', setLog, async function(req, res, next) {
    const { id, pass1, idx } = req.body;
    var dbPass = '';
    var inPass = '';

    await new Promise(function(resolve, reject) {
        const sql = `SELECT PASSWORD(?) as pass1 FROM dual`;
        db.query(sql, pass1, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        dbPass = data.pass1;
    });

    await new Promise(function(resolve, reject) {
        const sql = `SELECT pass1 FROM BOARD_tbl WHERE idx = ? AND id = ?`;
        db.query(sql, [idx, id], function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        if (!data) {
            inPass = null;
        } else {
            inPass = data.pass1;
        }
    });

    if (dbPass == inPass) {
        res.send({
            cnt: 1,
        });
    } else {
        res.send({
            cnt: 0,
        });
    }


});

router.get('/set_aricle_push/:parent_idx', setLog, async function(req, res, next) {
    var parent_idx = req.params.parent_idx;
    var dest_id = '';
    var writer = '';
    var board_id = '';
    var step = 0;
    var tmp_idx = 0;

    //항상 상위 댓글 작성자에게 푸시가 날라간다!

    await new Promise(function(resolve, reject) {
        var sql = `SELECT parent_idx, id, board_id, step FROM BOARD_tbl WHERE idx = ? `;
        db.query(sql, parent_idx, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        dest_id = data.id;

        tmp_idx = data.parent_idx;
        step = data.step;
        writer = data.id;
        board_id = data.board_id;
    });

    if (step == 2) {
        //최 상위글을 찾는다!!!
        parent_idx = tmp_idx;

        console.log(parent_idx);

        await new Promise(function(resolve, reject) {
            var sql = `SELECT idx, id, board_id, step FROM BOARD_tbl WHERE idx = ? `;
            db.query(sql, parent_idx, function(err, rows, fields) {
                if (!err) {
                    resolve(rows[0]);
                } else {
                    console.log(err);
                }
            });
        }).then(function(data) {
            tmp_idx = data.idx;
            writer = data.id;
        });
    }

    await new Promise(function(resolve, reject) {
        var result = utils.sendArticlePush(dest_id, '등록하신 게시물에 댓글이 등록되었습니다.', parent_idx, writer, board_id);
        resolve(result);
    }).then(function(data) {
        res.send({
            data: data
        });
    });
});

router.get('/', setLog, async function(req, res, next) {

    // await new Promise(function(resolve, reject) {
    //     var sql = ``;
    //     db.query(sql, function(err, rows, fields) {
    //         console.log(rows);
    //         if (!err) {
    //
    //         } else {
    //             console.log(err);
    //         }
    //     });
    // }).then(function(data) {
    //
    // });

    res.send('api');
});



module.exports = router;
