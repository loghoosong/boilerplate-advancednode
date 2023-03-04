const bcrypt = require('bcrypt');
const passport = require('passport');

module.exports = function (app, myDataBase) {
    app.route('/').get((req, res) => {
        res.render('index', {
            title: 'Connected to Database',
            message: 'Please log in',
            showLogin: true,
            showRegistration: true,
            showSocialAuth: true,
        });
    });

    app.route('/auth/github').get(passport.authenticate('github'));
    app.route('/auth/github/callback').get(
        passport.authenticate('github', { failureRedirect: '/' }),
        (req, res) => {
            req.session.user_id = req.user.id;
            res.redirect('/chat');
        }
    );

    app.route('/register').post(
        (req, res, next) => {
            const hash = bcrypt.hashSync(req.body.password, 12);

            myDataBase.findOne({ username: req.body.username }, (err, user) => {
                if (err) {
                    next(err);
                } else if (user) {
                    res.redirect('/');
                } else {
                    myDataBase.insertOne({
                        username: req.body.username,
                        password: hash,
                    }, (err, doc) => {
                        if (err) {
                            res.redirect('/');
                        } else {
                            next(null, doc.ops[0]);
                        }
                    });
                }
            })
        },
        passport.authenticate('local', { failureRedirect: '/' }),
        (req, res) => {
            res.redirect('/profile');
        }
    );

    app.route('/profile').get(ensureAuthenticated, (req, res) => {
        res.render('profile.pug', {
            username: req.user.username,
        });
    });

    app.route('/login').post(
        passport.authenticate('local', { failureRedirect: '/' }),
        (req, res) => {
            res.redirect('/profile');
        });

    app.route('/logout').get((req, res) => {
        req.logout();
        res.redirect('/');
    })

    app.route('/chat').get(ensureAuthenticated, (req, res) => {
        res.render('chat.pug', { user: req.user });
    });
}

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
}