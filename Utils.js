const fs = require('fs');
const db = require('./db');
const requestIp = require('request-ip');
const axios = require('axios');
const crypto = require('crypto');

class Utils {
    ToFloat(number){
    	var tmp = number + "";
    	if(tmp.indexOf(".") != -1){
    		number = number.toFixed(4);
    		number = number.replace(/(0+$)/, "");
    	}
    	return number;
    }

    setSaveMenu(req) {
        var self = this;
        return new Promise(function(resolve, reject) {
            if (req.query.name1 != null) {
                db.query('SELECT * FROM SAVE_MENU_tbl WHERE link = ? AND id = ?', [CURRENT_URL, req.session.mid], function(err, rows, fields) {
                    if (!err) {
                        if (rows.length == 0) {
                            var sql = `
                                INSERT INTO SAVE_MENU_tbl SET
                                id = ?,
                                name1 = ?,
                                link = ? `;
                            db.query(sql, [req.session.mid, req.query.name1, CURRENT_URL], function(err, rows, fields) {
                                console.log(err);
                                self.getSaveMenu(req).then(function(data) {
                                    resolve(data);
                                });
                            });
                        } else {
                            self.getSaveMenu(req).then(function(data) {
                                resolve(data);
                            });
                        }
                    } else {
                        console.log('err', err);
                        res.send(err);
                    }
                });
            } else {
                self.getSaveMenu(req).then(function(data) {
                    resolve(data);
                });
            }
        });
    }

    getSaveMenu(req) {
        return new Promise(function(resolve, reject) {
            if (req.session.mid != null) {
                db.query("SELECT * FROM SAVE_MENU_tbl WHERE id = ?", req.session.mid, function(err, rows, fields) {
                    if (!err) {
                        resolve(rows);
                    } else {
                        console.log('err', err);
                        res.send(err);
                    }
                });
            } else {
                resolve(0);
            }
        });
    }

    async sendPush(id, msg, menu_flag) {
        var fcmArr = [];
        await new Promise(function(resolve, reject) {
            var sql = "SELECT fcm FROM MEMB_tbl WHERE id = ? AND IS_push = 1 AND is_logout = 0"
            db.query(sql, id, function(err, rows, fields) {
                console.log(rows.length);
                if (!err) {
                    if (rows.length > 0) {
                        resolve(rows[0].fcm);
                    } else {
                        console.log(id + '의 IS_ALARM, IS_LOGOUT 값을 체크해보세요.');
                        return;
                    }
                } else {
                    console.log(err);
                    return;
                }
            });
        }).then(function(data) {
            fcmArr.push(data);
        });

        var fields = {};
        fields['notification'] = {};
        fields['data'] = {};

        fields['registration_ids'] = fcmArr;
        fields['notification']['title'] = 'Mybaby';
        fields['notification']['body'] = msg;
        // fields['notification']['click_action'] = 'NOTI_CLICK'; //액티비티 다이렉트 호출
        fields['priority'] = 'high';
        fields['data']['menu_flag'] = menu_flag;               //키값은 대문자 안먹음..

        var config = {
            method: 'post',
            url: 'https://fcm.googleapis.com/fcm/send',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'key=' + process.env.FCM_SERVER_KEY
            },
            data: JSON.stringify(fields),
        };

        var result = '';

        await new Promise(function(resolve, reject) {
            axios(config).then(function (response) {
                //알림내역저장
                if (response.data.success == 1) {
                    // const sql = "INSERT INTO ALARM_tbl SET ID = ?, MESSAGE = ?, WDATE = NOW()";
                    // db.query(sql, [id, msg]);
                }
                //
                resolve(response.data);
            }).catch(function (error) {
                resolve(error);
            });
        }).then(function(data) {
            result = data;
        });
        return result;
    }

    async sendArticlePush(id, msg, idx, writer, board_id) {
        var fcmArr = [];
        var resultObj = {};
        await new Promise(function(resolve, reject) {
            var sql = "SELECT fcm FROM MEMB_tbl WHERE id = ? AND IS_push = 1 AND is_logout = 0"
            db.query(sql, id, function(err, rows, fields) {
                console.log(rows.length);
                if (!err) {
                    if (rows.length > 0) {
                        resolve({
                            code: 1,
                            data: rows[0].fcm,
                        });
                    } else {
                        resolve({
                            code: 0,
                            data: `${id} 의 IS_ALARM, IS_LOGOUT 값을 체크해보세요.`,
                        });
                    }
                } else {
                    console.log(err);
                    resolve({
                        code: 0,
                        data: err,
                    });
                }
            });
        }).then(function(data) {
            resultObj = data;
        });

        if (resultObj.code == 1) {
            fcmArr.push(resultObj.data);
        } else {
            return resultObj.data;
        }


        var fields = {};
        fields['notification'] = {};
        fields['data'] = {};

        fields['registration_ids'] = fcmArr;
        fields['notification']['title'] = 'Siridoc';
        fields['notification']['body'] = msg;

        if (board_id == 'growth') {
            fields['notification']['click_action'] = 'growth_detail'; //액티비티 다이렉트 호출
        } else {
            fields['notification']['click_action'] = 'article_detail'; //액티비티 다이렉트 호출
        }

        fields['priority'] = 'high';
        fields['data']['idx'] = idx;
        fields['data']['writer'] = writer;
        fields['data']['board_id'] = board_id;

        var config = {
            method: 'post',
            url: 'https://fcm.googleapis.com/fcm/send',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'key=' + process.env.FCM_SERVER_KEY
            },
            data: JSON.stringify(fields),
        };

        var result = '';

        await new Promise(function(resolve, reject) {
            axios(config).then(function (response) {
                //알림내역저장
                if (response.data.success == 1) {
                    // const sql = "INSERT INTO ALARM_tbl SET ID = ?, MESSAGE = ?, WDATE = NOW()";
                    // db.query(sql, [id, msg]);
                }
                //
                resolve(response.data);
            }).catch(function (error) {
                resolve(error);
            });
        }).then(function(data) {
            result = data;
        });
        return result;
    }

    async queryResult(sql, params) {
        var arr = [];
        await new Promise(function(resolve, reject) {
            db.query(sql, params, function(err, rows, fields) {
                if (!err) {
                    resolve(rows);
                } else {
                    reject(err);
                }
            });
        }).then(async function(data) {
            arr = data;
        }).catch(function(reason) {
            arr = reason;
        });
        arr = await this.nvl(arr);
        return arr;
    }

    //null 값은 빈값으로 처리해준다!!
    nvl(arr) {
        if (arr == null) {
            return arr;
        }

        if (arr.length != null) {
            for (var rows of arr) {
                for (var i in rows) {
                    if (rows[i] == null || rows[i] == 'null') {
                        rows[i] = '';
                    }
                }
            }
        } else {
            for (var i in arr) {
                if (arr[i] == null || arr[i] == 'null') {
                    arr[i] = '';
                }
            }
        }
        return arr;
    }

    getAge(birth) {
        var date = new Date();
        var year = date.getFullYear();
        var tmp = birth.split('-')[0];
        var age = year - tmp;
        return age;
    }

    getAge2(birth, year) {
        console.log(birth, year);
        var tmp = birth.split('-')[0];
        var age = year - tmp;
        return age;
    }

    pageHelper(page, rowCount) {
        if (!page) {
            page = 1;
        }

        const pageNum = page; // NOTE: 쿼리스트링으로 받을 페이지 번호 값, 기본값은 1
        const contentSize = 10; // NOTE: 페이지에서 보여줄 컨텐츠 수.
        const pnSize = 10; // NOTE: 페이지네이션 개수 설정.
        const skipSize = (pageNum - 1) * contentSize; // NOTE: 다음 페이지 갈 때 건너뛸 리스트 개수.
        const totalCount = Number(rowCount); // NOTE: 전체 글 개수.
        const pnTotal = Math.ceil(totalCount / contentSize); // NOTE: 페이지네이션의 전체 카운트
        const pnStart = ((Math.ceil(pageNum / pnSize) - 1) * pnSize) + 1; // NOTE: 현재 페이지의 페이지네이션 시작 번호.
        var pnEnd = (pnStart + pnSize) - 1; // NOTE: 현재 페이지의 페이지네이션 끝 번호.
        if (pnEnd > pnTotal) {
            pnEnd = pnTotal;
        }
        var pnPrev = pnStart - 1;
        var pnNext = pnEnd + 1;
        if (pnNext >= pnTotal) {
            pnNext = 0;
        }

        const data = {
            skipSize,
            contentSize,
            pageNum,
            pnStart,
            pnEnd,
            pnTotal,
            pnPrev,
            pnNext,
        }

        return data;
    }

    utilConvertToMillis(time) {
        var time = new Date(time).getTime() / 1000;
        var currentTime = Math.floor(new Date().getTime()/1000);
        var inputTime = time;
        var diffTime = currentTime - inputTime;
        var postTime;
        switch(true) {
            case diffTime < 60 :
                postTime = '방금';
                break;
            case diffTime < 3600 :
                postTime = parseInt(diffTime / 60) + '분 전';
                break;
            case diffTime < 86400 :
                postTime = parseInt(diffTime / 3600) + '시간 전';
                break;
            case diffTime < 604800 :
                postTime = parseInt(diffTime / 86400) + '일 전';
                break;
            case diffTime > 604800 :
                var date = new Date(time * 1000);
                var month = eval(date.getMonth() + 1);
                var day = date.getDate();
                if (eval(date.getMonth() + 1) < 10) {
                    month = "0" + eval(date.getMonth() + 1);
                }
                if (date.getDate() < 10) {
                    day = "0" + date.getDate()
                }
                postTime = date.getFullYear() + "-" + month + "-" + day;
                break;
            default: 
                postTime = time;
        }
        return postTime;
    }
}

module.exports = new Utils();
