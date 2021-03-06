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
                        console.log(id + '??? IS_ALARM, IS_LOGOUT ?????? ??????????????????.');
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
        // fields['notification']['click_action'] = 'NOTI_CLICK'; //???????????? ???????????? ??????
        fields['priority'] = 'high';
        fields['data']['menu_flag'] = menu_flag;               //????????? ????????? ?????????..

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
                //??????????????????
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
                            data: `${id} ??? IS_ALARM, IS_LOGOUT ?????? ??????????????????.`,
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
            fields['notification']['click_action'] = 'growth_detail'; //???????????? ???????????? ??????
        } else {
            fields['notification']['click_action'] = 'article_detail'; //???????????? ???????????? ??????
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
                //??????????????????
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

    //null ?????? ???????????? ???????????????!!
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
}

module.exports = new Utils();
