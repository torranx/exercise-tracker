const passport = require('passport');
const bcrypt = require('bcrypt');
const User = require('./user.model');
const Exercise = require('./exercise.model');

module.exports = (app) => {
    const ensureAuthenticated = (req, res, next) => {
        if (req.isAuthenticated()) {
            console.log('authenticated')
            return next()
        }
        console.log('not authenticated')
        res.send({
            logged_in: false
        })
    }

    app.route('/auth/github')
        .get(passport.authenticate('github'));

    app.route('/auth/github/callback')
        .get(passport.authenticate('github', {
            successRedirect: '/dashboard'
        })
    )
    
    app.get('/logged_in', ensureAuthenticated, (req, res) => {
        res.send({
            logged_in: true
        })
    })

    app.post('/api/register', (req, res, next) => {
        let {first_name, last_name, username, password} = req.body;
        User.findOne({
            username: username
        }, (err, user) => {
            if (err) {
                console.log(err);
                throw new Error('An error occured. Please try again.')
            } else if (user) { 
                res.send({
                    error: 'Username already taken.'
                })
            } else {
                console.log('new user')
                const hash = bcrypt.hashSync(password, 12);
                new User({
                    first_name: first_name,
                    last_name: last_name,
                    username: username,
                    password: hash
                })
                .save((err, doc) => {
                    if (err) {
                        console.log(err)
                    } else {
                        next(null, doc)
                    }
                });
            }
        })
    }, passport.authenticate('local'), (req, res) => {
        res.send({username: req.user.username, logged_in: true})
    });

    app.post('/api/login', passport.authenticate('local'), (req, res) => {
        res.send({username: req.user.username, logged_in: true})
    }); //TO DO: Delete?

    app.get('/logout', (req, res) => {
        req.logout();
        res.send('Logged out')
    })
    
    app.post('/exercise/add', ensureAuthenticated, (req, res) => {
        let {description, duration, date} = req.body;
        User.findById(req.user._id, (err, data) => {
            if (err) {
                console.log(err);
                throw new Error('An error occured. Please try again.')
            } else {
                if (data) {
                    new Exercise({
                        userId: data._id,
                        description: description,
                        duration: duration,
                        date: (!date) 
                            ? new Date()
                            : new Date(date)
                    }).save((err, exercise) => {
                        if (err) {
                            console.log(err);
                            res.status(500)
                                .send({
                                    message: "An error occured, please try again"
                                })
                        }
                        res.send({
                            message: "New exercise added!"
                        })
                    })
                }
            }
        })
    });

    app.put('/edit', ensureAuthenticated, (req, res) => {
        let updates = {};
        for (const [key, value] of Object.entries(req.body)) {
            updates[key] = value
        }
        if (updates.date == '') {
            updates.date = new Date()
        }
        Exercise.findByIdAndUpdate(req.query.id, updates, {
            new: true
        }, (err, doc) => {
            if (err) {
                console.log(err);
                res.status(500)
                    .send({
                        message: "An error occured, please try again"
                    })
            } else {
                res.send("Exercise edited")
            }
        })
    })

    app.delete('/delete', ensureAuthenticated, (req, res) => {
        Exercise.deleteMany(
            req.query.id 
            ? {_id: req.query.id}
            : {}, (err, doc) => {
            if (err) {
                console.log(err);
                return res.status(500)
                    .send({
                        message: "An error occured, please try again"
                    })
            }   else {
                res.send("Exercise deleted")
            }
        })
    })

    app.get('/exercise/log', ensureAuthenticated, (req, res) => {
        let {fromDate, toDate, limit, exerciseId} = req.query;
        Exercise.find(
            exerciseId
            ? {
                _id: exerciseId
            }
            : {
                userId: req.user._id
            }, (err, exercise) => {
            if (err) {
                console.log(err);
                throw new Error('An error occured. Please try again.')
            } else {
                if (exercise) {
                    let totalCount = 0;
                    let logArr = [];
                    let fromObj = new Date(fromDate);
                    let toObj = new Date(toDate);

                    for (let i = 0; i < exercise.length; i++) {
                        if (totalCount == limit) {
                            break
                        }

                        const data = {
                            _id: exercise[i]._id,
                            description: exercise[i].description,
                            duration: exercise[i].duration,
                            date:exercise[i].date.toUTCString()
                        };

                        if (exercise[i].date >= fromObj && exercise[i].date <= toObj) { //Date range
                            totalCount += 1;
                            logArr.push(data);
                        } else if (exercise[i].date >= fromObj && !toDate) { //Results from given 'from' date
                            totalCount += 1;
                            logArr.push(data)
                        } else if (!fromDate && !toDate) { //All results
                            totalCount += 1;
                            logArr.push(data)
                        }
                    }
                    res.send({
                        log: logArr
                    })
                }
            }
        })
    })
}