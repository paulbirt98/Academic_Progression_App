const express = require('express');
const app = express();
const port = 3000;
const db = require('./database');
const path = require('path');
const sessions = require('express-session');
const oneHour = 1000 * 60 * 60 * 1;
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const multer = require('multer');
const csv = require('csv-parser');


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
    
        res.render('loginPage', {query: req.query});
    
});

app.post('/', (req, res) => {
    const userEmail = req.body.email;
    const userPassword = req.body.password;

    const checkDetails = `SELECT * 
                            FROM authentication 
                            WHERE user_email = ? AND user_password = ?`;

    
    db.query(checkDetails, [userEmail, userPassword], (err, user) =>{

        if(err){
            console.error('Database error', err);
            res.sendStatus(500);
        }

            if(user.length > 0 && user[0].admin === 1){
                req.session.isAdmin = true;
                res.redirect('/admin/admin-home');
            } else if (user.length > 0 && user[0].admin === 0){
                req.session.studentId = user[0].student_id;
                req.session.isStudent = true;
                res.redirect('/student/student-home')

            } else {
                res.redirect('/?loginFailure=1');
            }

    });

    

});

app.listen(port, () => {
    console.log('Server is running on port 3000');
});