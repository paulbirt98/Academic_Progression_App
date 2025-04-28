const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/student-home', async (req, res) =>{

    if(req.session.isStudent){
        const studentNameQuery =  `SELECT first_name
                                    FROM student
                                    WHERE student_id = ?`;

        try{
            const [queryResult] = await db.promise().query(studentNameQuery, req.session.studentId);
            res.render('studentHomepage', {title: 'Student Homepage',
                                            isStudent: true,
                                            studentName: queryResult[0].first_name});
        } catch (err) {
            console.error('Database error:', err);
            res.sendStatus(500);
        }

        
    } else {
        res.redirect('/');
    }

});

router.get('/profile', async (req, res) =>{

    if(req.session.isStudent){
        const profileInfoQuery =  `SELECT 
                                        CONCAT(student.first_name, ' ', student.last_name) as name,
                                        student.student_id_number,
                                        student.stage,
                                        student.profile_image,
                                        CONCAT(pathway.pathway_name, ' ', pathway.pathway_code) as course,
                                        authentication.user_email,
                                        authentication.secondary_email
                                    FROM student
                                    LEFT JOIN pathway ON student.pathway_id = pathway.pathway_id
                                    LEFT JOIN authentication ON student.student_id = authentication.student_id
                                    WHERE student.student_id = ?`;

        try{
            const [queryResult] = await db.promise().query(profileInfoQuery, req.session.studentId);
            res.render('studentProfile', {title: 'Student Profile',
                                            isStudent: true,
                                            studentInfo: queryResult[0]});
        } catch (err) {
            console.error('Database error:', err);
            res.sendStatus(500);
        }

        
    } else {
        res.redirect('/');
    }

});

router.get('/my-grades', async (req, res) => {

    if(req.session.isStudent){
        const studentDataQuery = `SELECT 
                                        CONCAT(first_name, ' ', last_name) AS name,
                                        student_id_number AS id_number,
                                        stage
                                    FROM student WHERE student_id = ?`;

        const studentPathwayQuery = `SELECT
                                        pathway.pathway_name
                                    FROM student
                                    JOIN pathway ON student.pathway_id = pathway.pathway_id
                                    WHERE student.student_id = ?`;
        
        const yearsStudiedQuery = `SELECT DISTINCT 
                                        module.academic_year
                                    FROM student_module
                                    JOIN module ON student_module.module_id = module.module_id
                                    WHERE student_module.student_id = ?
                                    ORDER BY academic_year; `
        
        const modulesStudiedQuery = `SELECT 
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
                                    ORDER BY module.academic_year, module.module_title;`

        const studentId = req.session.studentId;

        try {
            const [studentData] = await db.promise().query(studentDataQuery, [studentId]);
            const [studentPathway] = await db.promise().query(studentPathwayQuery, [studentId]);
            const [yearsStudied] = await db.promise().query(yearsStudiedQuery, [studentId]);
            const [modulesStudied] = await db.promise().query(modulesStudiedQuery, [studentId]);
            res.render('viewStudentRecord', {title: "Student Record - " + studentData[0].id_number, 
                topic: "student",
                record: studentData[0],
                pathway: studentPathway[0],
                years: yearsStudied,
                modules: modulesStudied,
                isStudent: true});
        } catch (err) {
            console.error('Database error:', err);
            res.sendStatus(500);
        }
 
    } else {
        res.redirect('/');
    }

});

module.exports = router;