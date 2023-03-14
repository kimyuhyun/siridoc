const CryptoJS = require("crypto-js");

module.exports = {
    encrypt: (text) => {
        try {
            var secretkey = process.env.CRYPTO_KEY; //Length 16
            var key = CryptoJS.enc.Utf8.parse(secretkey);
            var iv = CryptoJS.enc.Utf8.parse(secretkey.substring(0, 16));
            var cipherText = CryptoJS.AES.encrypt(`${text}`, key, {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            }).toString();
            return cipherText;
        } catch (err) {
            return '';
        }
    },
    decrypt: (text) => {
        try {
            var secretkey = process.env.CRYPTO_KEY; //Length 16
            var key = CryptoJS.enc.Utf8.parse(secretkey);
            var iv = CryptoJS.enc.Utf8.parse(secretkey.substring(0, 16));
            var decrypted = CryptoJS.AES.decrypt(`${text}`, key, {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            });
            var text = decrypted.toString(CryptoJS.enc.Utf8);
            return text;
        } catch (err) {
            return '';
        }
    },
}