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
    res.render('adminHome', {title: "Welcome to the Admin Dashboard", 
                            summary: "Manage students, modules, grades and communications"});
});

app.get('/student-management', async (req, res) => {
    //the values to be used in the page header and list ejs templates
    const studentTemplateQuery  = `SELECT 
                            CONCAT(student.first_name, ' ', student.last_name) AS name,
                            student.student_id_number AS id_code,
                            CONCAT(pathway.pathway_name, ' - Stage ', student.stage) AS moreInfo
                        FROM student
                        JOIN pathway ON student.pathway_id = pathway.pathway_id;`;

    try{
        const [studentTemplateData] = await db.promise().query(studentTemplateQuery);
        res.render('adminManagement', { title: "Student Management",
                                        topic: "Student", 
                                        summary: "Manage student records, view details, and update information.",
                                        specificFilter: "Name",
                                        templateData: studentTemplateData});
    } catch (err) {
        console.error('Database error:', err);
        res.sendStatus(500);
    }
});

app.listen(port, () => {
    console.log('Server is running on port 3000');
});