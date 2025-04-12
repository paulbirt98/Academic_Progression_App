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
app.use(express.urlencoded({ extended: true}));

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
                                JOIN pathway ON student.pathway_id = pathway.pathway_id
                                ORDER BY student.last_name, student.first_name`;
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
        //get each year the student has studied and reformat
        const [yearsStudied] = await db.promise().query(`SELECT DISTINCT 
                                                            module.academic_year
                                                        FROM student_module
                                                        JOIN module ON student_module.module_id = module.module_id
                                                        WHERE student_module.student_id = ?
                                                        ORDER BY academic_year; `, [studentURLId]);
        const [modulesStudied] = await db.promise().query(`SELECT 
                                                            module.module_title,
                                                            module.academic_year,
                                                            student_module.first_grade,
                                                            student_module.grade_result,
                                                            student_module.resit_grade,
                                                            student_module.resit_result,
                                                            student_module.final_attempt,
                                                            (SELECT module_pathway.core
                                                                FROM module_pathway
                                                                WHERE module_pathway.module_id = module.module_id
                                                                AND module_pathway.pathway_id = student.pathway_id
                                                                LIMIT 1
                                                            ) AS core
                                                        FROM student_module
                                                        JOIN module 
                                                            ON student_module.module_id = module.module_id
                                                        JOIN student 
                                                            ON student_module.student_id = student.student_id
                                                        WHERE student_module.student_id = ?
                                                        ORDER BY module.academic_year, module.module_title;`, [studentURLId]);
        res.render('viewStudentRecord', {title: "Student Record - " + studentData[0].student_id_number, 
                                        student: studentData[0],
                                        pathway: studentPathway[0],
                                        years: yearsStudied,
                                        modules: modulesStudied});
    } catch (err){
        console.error('Database error:', err);
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

app.get('/add-student', async (req, res) => {

    const pathwayOptionsQuery = `SELECT * FROM pathway;`;

    try{
        const[pathwayOptions] = await db.promise().query(pathwayOptionsQuery);
        res.render('addStudent', {title: "Add Student Record",
                                    summary: "Enter student details to add the record to GradeGuru.",
                                    pathways: pathwayOptions});
    } catch {
        console.error('Database error:', err);
        res.sendStatus(500);
    }
});

app.post('/add-student', (req, res) => {
    const adminInput = {...req.body}
});

app.listen(port, () => {
    console.log('Server is running on port 3000');
});