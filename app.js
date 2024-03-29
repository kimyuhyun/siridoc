process.env.NODE_ENV = (process.env.NODE_ENV && (process.env.NODE_ENV).trim().toLowerCase() == 'production') ? 'production' : 'development';

const createError = require('http-errors');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const path = require('path');
const cookieParser = require('cookie-parser');
const requestIp = require('request-ip');
const logger = require('morgan');
const db = require('./db');

const indexRouter = require('./routes/index');
const admRouter = require('./routes/adm');
const crudRouter = require('./routes/crud');
const apiCrudRouter = require('./routes/api_crud');
const analyzerRouter = require('./routes/analyzer');
const articleRouter = require('./routes/article');
const apiRouter = require('./routes/api');
const authRouter = require('./routes/auth');
const termsRouter = require('./routes/terms');
const familyRouter = require('./routes/family');
const muscleRouter = require('./routes/muscle');
const muscleCheckRouter = require('./routes/muscle_check');


const app = express();

app.use(requestIp.mw());
app.use(session({
    key: 'sid',
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    store: new MySQLStore(db.connAccount),
    cookie: {
        maxAge: 24000 * 3600 // 쿠키 유효기간 24시간
    }
}));

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'ejs');

// view engine setup
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({
    extended: false
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/data', express.static('data'));

app.use('/', indexRouter);
app.use('/adm', admRouter);
app.use('/crud', crudRouter);
app.use('/api_crud', apiCrudRouter);
app.use('/analyzer', analyzerRouter);
app.use('/article', articleRouter);
app.use('/api', apiRouter);
app.use('/auth', authRouter);
app.use('/terms', termsRouter);
app.use('/family', familyRouter);
app.use('/muscle', muscleRouter);
app.use('/muscle_check', muscleCheckRouter);
app.use('/new_muscle_check', require('./routes/new_muscle_check'));
app.use('/patient', require('./routes/patient'));
app.use('/file_upload', require('./routes/file_upload'));
app.use('/health_article', require('./routes/health_article'));
app.use('/user', require('./routes/user'));
app.use('/api2', require('./routes/api2'));
app.use('/aud', require('./routes/aud'));
app.use('/history', require('./routes/history'));
app.use('/map', require('./routes/map'));
app.use('/dr_allgn', require('./routes/dr_allgn'));





// catch 404 and forward to error handler
app.use(function(req, res, next) {
    res.status(404).send('페이지가 없습니다.');
    res.status(500).send('500 에러');
    next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
    console.log('ENV', process.env.NODE_ENV);
    console.log('ENV', req.app.get('env'));

    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    app.locals.hostname = process.env.HOST_NAME;

    console.log(err);

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
