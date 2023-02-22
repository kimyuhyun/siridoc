const jwt = require('jsonwebtoken');
const secret = process.env.SECRET;

module.exports = {
    sign: (id) => {   // access token 발급
        const payload = {   // access token에 들어갈 payload
            id: id
        };

        return jwt.sign(payload, secret, {
            algorithm: 'HS256',     // 암호화 알고리즘
            expiresIn: '24h', 	    // 유효기간
        });
    },
    verify: (token) => { // access token 검증
        var decoded = null;
        try {
            decoded = jwt.verify(token, secret);            
            return {
                ok: true,
                id: decoded.id,
            };
        } catch (err) {
            return {
                ok: false,
                message: err.message,
            };
        }
    },
    // refresh: () => {                    // refresh token 발급
    //     return jwt.sign({}, secret, {   // refresh token은 payload 없이 발급
    //         algorithm: 'HS256',
    //         expiresIn: '14d'
    //     });
    // },
    // refreshVerify: async (token, userId) => {
    //     // refresh token 검증
    //     const getAsync = promisify(redisClient.get).bind(redisClient);
    //     try {
    //         const data = await getAsync(userId); // refresh token 가져오기
    //         if (token === data) {
    //             try {
    //                 jwt.verify(token, secret);
    //                 return true;
    //             } catch (err) {
    //                 return false;
    //             }
    //         } else {
    //             return false;
    //         }
    //     } catch (err) {
    //         return false;
    //     }
    // },
}