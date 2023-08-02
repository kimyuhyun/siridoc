const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const fs = require("fs");
const multer = require("multer");
const uniqid = require("uniqid");
const cors = require("cors");

const axios = require("axios");
const FormData = require("form-data");
const path = require("path");

require("dotenv").config();

var upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            var date = new Date();
            var month = eval(date.getMonth() + 1);
            if (eval(date.getMonth() + 1) < 10) {
                month = "0" + eval(date.getMonth() + 1);
            }
            var dir = "data/" + date.getFullYear() + "" + month;
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }
            cb(null, dir);
        },
        filename: function (req, file, cb) {
            var tmp = file.originalname.split(".");
            var mimeType = tmp[tmp.length - 1];
            if ("php|phtm|htm|cgi|pl|exe|jsp|asp|inc".includes(mimeType)) {
                cb(null, file.originalname + "x");
                return;
            }

            if ("pdf|ppt|pptx|xls|xlsx|doc|docx|hwp|zip|txt".includes(mimeType)) {
                cb(null, file.originalname);
            } else {
                cb(null, uniqid(file.filename) + "." + mimeType);
            }
        },
    }),
});

/* GET home page. */
router.get("/", function (req, res, next) {
    console.log(process.env.HOST_NAME);
    var html =
        `
        <link rel="icon" href="data:;base64,iVBORw0KGgo=">
        <div>` +
        process.env.HOST_NAME +
        `</div>
        <form method='post' action='/file_upload/file_upload' enctype='multipart/form-data'>
            <input type='file' name='upload_file' />
            <input type='submit'>
        </form>
    `;
    res.send(html);
});

router.post("/file_upload", cors(), upload.single("upload_file"), async function (req, res, next) {
    const file = req.file;
    var result = "";
    var type = "";

    await new Promise(function (resolve, reject) {
        var destWidth = 1080;
        var tmp = file.originalname.split(".");
        var mimeType = tmp[tmp.length - 1];
        tmp = file.filename.split(".");
        var filename = tmp[0];
        var resizeFile = file.destination + "/" + filename + "_resize." + mimeType;

        if ("jpg|jpeg|png|gif".includes(mimeType)) {
            resolve({
                path: file.path,
                type: mimeType,
            });
        }
    }).then(function (data) {
        result = data.path;
        type = data.type;
    });

    var interval = setInterval(function () {
        console.log(isFileUploaded(result));
        if (isFileUploaded(result)) {
            clearInterval(interval);
            var path = process.env.HOST_NAME + "/" + result;
            // res.send("<img src='" + path + "'/>");

            res.send({
                url: path,
                type: type,
            });
        }
    }, 500);
});

async function isFileUploaded(path) {
    await new Promise(function (resolve, reject) {
        fs.exists(path, function (exists) {
            resolve(exists);
        });
    }).then(function (data) {
        console.log(data);
        return data;
    });
}

router.post("/link_upload", cors(), async function (req, res, next) {
    const urlLink = req.body.url_link;
    console.log(urlLink);
    var imageResponse = await axios({
        url: urlLink,
        method: "GET",
        responseType: "arraybuffer",
    });
    const extension = path.extname(urlLink);

    //Create form data
    const form = new FormData();
    form.append("upload_file", imageResponse.data, {
        contentType: `image/${extension}`,
        name: `image`,
        filename: `imageFileName.${extension}`,
    });

    //Submit form
    const result = await axios({
        url: `${process.env.HOST_NAME}/image/file_upload`,
        method: "POST",
        data: form,
        headers: { "Content-Type": `multipart/form-data; boundary=${form._boundary}` },
    });
    res.send(result.data);
});

router.get("/drag_and_drop", function (req, res, next) {
    res.render("drag_and_drop.html");
});

module.exports = router;
