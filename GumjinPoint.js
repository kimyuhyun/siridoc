

module.exports = {
    getSquatPoint: (value) => {
        var point = 0;
        if (value < 11.2) {
            point = 3;
        } else if (value >= 11.2 && value < 16.7) {
            point = 2;
        } else if (value >= 16.7) {
            point = 1;
        }
        return point;
    },
    getAkrukPoint: (gender, value) => {
        var point = 0;
        if (gender == 1) {
            if (value < 23) {
                point = 1;
            } else if (value >= 23 && value < 26) {
                point = 2;
            } else if (value >= 26) {
                point = 3;
            }
        } else {
            if (value < 13) {
                point = 1;
            } else if (value >= 13 && value < 16) {
                point = 2;
            } else if (value >= 16) {
                point = 3;
            }
        }
        return point;
    },
    getJongariPoint: (gender, value) => {
        var point = 0;
        if (gender == 1) {
            if (value < 30) {
                point = 1;
            } else if (value >= 30 && value < 32) {
                point = 2;
            } else if (value >= 32) {
                point = 3;
            }
        } else {
            if (value < 29) {
                point = 1;
            } else if (value >= 29 && value < 31) {
                point = 2;
            } else if (value >= 31) {
                point = 3;
            }
        }
        return point;
    },
    getASMPoint: (gender, value) => {
        var point = 0;

        if (!value) {
            return point;
        }

        if (gender == 1) {
            if (value < 8) {
                point = 1.5;
            } else {
                point = 3;
            }
        } else {
            if (value < 6.2) {
                point = 1.5;
            } else {
                point = 3;
            }
        }
        return point;
    },
}