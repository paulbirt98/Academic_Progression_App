const express = require('express');
const app = express();
const port = 3000;
const db = require('./database');
const path = require('path');
const sessions = require('express-session');
const oneHour = 1000 * 60 * 60 * 1;
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');


db.getConnection((err) => {
    if (err) return console.log(err.message);
    console.log("connected successfully");
});

module.exports = db; //exports db... allows other parts of the app to import and use the connection pool

app.use(sessions({
    secret: "userS3ss1onS3cr3t",
    saveUninitialized: true,
    cookie: {maxAge: oneHour},
    resave: false
}));

//middleware
app.use(express.static(path.join(__dirname, './assets'))); //serving static files
app.use(express.urlencoded({ extended: true}));

//get the routes for student and admin
app.use('/student', studentRoutes);
app.use('/admin', adminRoutes);

app.set('view engine', 'ejs');

app.get('/', (req, res) =>{
    
        res.render('loginPage');
    
});

app.post('/', (req, res) => {
    const userEmail = req.body.email;
    const userPassword = req.body.password;

    const checkDetails = `SELECT * 
                            FROM authentication 
                            WHERE 
                            user_email = ?
                            AND
                            user_password = ?`;

    
    db.query(checkDetails, [userEmail, userPassword], (err, user) =>{

        if(err){
            console.error('Database error', err);
        } else {
            if(user.length > 0){
                req.session.isAdmin = user[0].admin;
                res.redirect('/admin/admin-home');
            } else {
                res.redirect('/');
            }
        }

    });

    

});

app.listen(port, () => {
    console.log('Server is running on port 3000');
});