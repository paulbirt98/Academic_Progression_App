const express = require('express');
const app = express();
const port = 3000;
const mysql = require('mysql2');
const path = require('path');

//database connection
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'academic_progression_app',
    port: '3306'
});

db.getConnection((err) => {
    if (err) return console.log(err.message);
    console.log("connected successfully");
});

module.exports = db; //exports db... allows other parts of the app to import and use the connection pool

//middleware
app.use(express.static(path.join(__dirname, './assets'))); //serving static files

app.set('view engine', 'ejs');

app.get('/admin-home', (req, res) => {

    res.render('adminHome');

});

app.get('/student-management', (req, res) => {

    let sqlQuery  = `SELECT 
                        student.first_name,
                        student.last_name,
                        student.student_id_number,
                        pathway.pathway_name,
                        student.stage
                    FROM student
                    JOIN pathway ON student.pathway_id = pathway.pathway_id;`;

    db.query(sqlQuery, (err, students) => {
        if(err) throw err;
        res.render('adminStudentManage', {studentData : students});
        
    });
});

app.listen(port, () => {
    console.log('Server is running on port 3000');
});