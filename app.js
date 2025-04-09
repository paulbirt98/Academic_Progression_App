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
    res.render('adminHome', {title: "Admin Dashboard", 
                            summary: "Manage students, modules, grades and communications"});
});

app.get('/students', async (req, res) => {
    //the values to be used in the list in the adminManagement ejs
    const studentTemplateQuery  = `SELECT 
                                    student.student_id AS idReference,
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

app.get('/students/view/:id', async (req, res) => {
    try{
        const studentURLId = req.params.id;
        const [studentData] = await db.promise().query(`SELECT * FROM student WHERE student_id = ?`, [studentURLId]);
        const [studentPathway] = await db.promise().query(`SELECT
                                                            pathway.pathway_name
                                                        FROM student
                                                        JOIN pathway ON student.pathway_id = pathway.pathway_id
                                                        WHERE student.student_id = ?`, [studentURLId]);
        res.render('viewStudentRecord', {title: "Student Record - " + studentData[0].student_id_number, 
                                        student: studentData[0],
                                        pathway: studentPathway[0]});
    } catch (err){
        console.err('Database error:', err);
        res.sendStatus(500);
    }
});

app.get('/modules', async (req, res) =>{
    //the values to be inputted into the list on'management page' ejs template
    const moduleTemplateQuery = `SELECT
                                    module_id AS idReference,
                                    module_title AS name,
                                    subject_id AS id_code,
                                    CONCAT('Credits: ', credit_count) AS moreInfo
                                FROM module;`
    try{
        const [moduleTemplateData] = await db.promise().query(moduleTemplateQuery);
        res.render('adminManagement', {title: "Module Management",
                                        topic: "Module",
                                        summary: "Manage academic modules and pathways.",
                                        specificFilter: "Pathway",
                                        templateData: moduleTemplateData});
    } catch (err) {
        console.error('Database error:', err);
        res.sendStatus(500);
    }
});

app.listen(port, () => {
    console.log('Server is running on port 3000');
});