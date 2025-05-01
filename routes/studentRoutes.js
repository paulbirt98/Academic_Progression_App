const express = require('express');
const router = express.Router();
const db = require('../database');

const calculateGrade = (student) => {

    if (student.grade_result === "pass") {
        return student.first_grade;
    } else if (student.resit_result === "pass") {
        return student.resit_grade;
    } else if (student.grade_result === "pass capped" || student.resit_result === "pass capped") {
        return 40;
    } else if ((student.grade_result === "excused" && student.resit_result === null) || student.resit_result === "excused") {
        return null;
    } else {
        //check and return highest of the two grades
        return (student.first_grade === null && student.resit_grade === null) ? null : Math.max(student.first_grade, student.resit_grade);
    }
};

const calculateAverageGrade = (total, numberOfInstances) => {
    return numberOfInstances > 0 ? (total / numberOfInstances).toFixed(2) : console.log('issue calculating average');
};

const getProgressionDecision = (student, modules, academicYear, stage) => {
    const credits = student.attained_credits;

    for (const module of modules) {
        if(module.year_delivered === stage && module.academic_year === academicYear){
            if (module.core && !module.final_attempt && !module.passed) {
            return "Failed Core Module - repeat the year"
            }

            if (module.final_attempt && !module.passed){
            return "Failed final attempt - withdraw from the course"
            } 
        }
    };

    if(!credits[stage] || credits[stage] < 100){
        return "Insufficient Credits - repeat the year"
    }

    if(stage === 2 && (!credits[1] || credits[1] < 120)){
        return "All stage 1 modules must be passed to progress - please contact your advisor of studies"
    }

    return "Progress to the next stage"
};

router.get('/progression', async (req, res) => {

    if (req.session.isStudent) {

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

        const modulesStudiedQuery = `SELECT DISTINCT
                                        module.module_title,
                                        module.semester,
                                        module.academic_year,
                                        module.credit_count,
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
                                        ) AS core,
                                        module_pathway.year_delivered
                                    FROM student_module
                                    JOIN module 
                                        ON student_module.module_id = module.module_id
                                    JOIN student 
                                        ON student_module.student_id = student.student_id
                                    LEFT JOIN module_pathway
                                        ON module.module_id = module_pathway.module_id
                                    WHERE student_module.student_id = ?
                                    ORDER BY module.academic_year, module.module_title`;

        const yearsStudiedQuery = `SELECT DISTINCT 
                                        module.academic_year,
                                        MAX(module_pathway.year_delivered) AS year_stage
                                    FROM student_module
                                    JOIN module ON student_module.module_id = module.module_id
                                    JOIN module_pathway ON module.module_id = module_pathway.module_id
                                    WHERE student_module.student_id = ?
                                    GROUP BY module.academic_year
                                    ORDER BY academic_year; `


        try {
            const [modulesStudied] = await db.promise().query(modulesStudiedQuery, req.session.studentId);
            const [yearsStudied] = await db.promise().query(yearsStudiedQuery, req.session.studentId);
            const [studentPathway] = await db.promise().query(studentPathwayQuery, req.session.studentId);
            const [studentData] = await db.promise().query(studentDataQuery, req.session.studentId);
            //work out credits for the progression stats
            const stageCredits = [];
            studentData[0].attained_credits = {};

            modulesStudied.forEach((module) => {

                if (module.grade_result.includes('pass') || module.resit_result.includes('pass')) {

                    module.passed = true;

                    if (!stageCredits[module.year_delivered]) {
                        stageCredits[module.year_delivered] = 0;
                    }

                    if (!studentData[0].attained_credits[module.year_delivered]) {
                        studentData[0].attained_credits[module.year_delivered] = 0;
                    }

                    stageCredits[module.year_delivered] += module.credit_count;
                    studentData[0].attained_credits[module.year_delivered] += module.credit_count;
                }

                if ((module.grade_result === "excused" && module.resit_result === null) || module.resit_result === "excused") {
                    module.excused = true;
                }
            });

            //work out average grade for both semesters and the full year (counting FYR modules in SPR)
            const autumnAverageByYear = [];
            const springAverageByYear = [];


            yearsStudied.forEach((year) => {

                let autTotalMarksWeighted = 0;
                let autTotalCredits = 0;
                let sprTotalMarksWeighted = 0;
                let sprTotalCredits = 0;
                let fyrTotalMarksWeighted = 0;
                let fyrTotalCredits = 0;

                modulesStudied.forEach((module) => {
                    if (year.academic_year === module.academic_year) {
                        const grade = calculateGrade(module);

                        if (!grade) return;

                        const credits = module.credit_count;

                        switch (module.semester) {
                            case "AUT":
                                autTotalMarksWeighted += grade * credits;
                                autTotalCredits += credits;
                                break;
                            case "SPR":
                                sprTotalMarksWeighted += grade * credits;
                                sprTotalCredits += credits;
                                break;
                            case "FYR":
                                sprTotalMarksWeighted += grade * credits;
                                sprTotalCredits += credits;
                                break;
                            default:
                                console.log(`Issue with grade ${module.module_title}`);
                        };
                    };
                });

                fyrTotalMarksWeighted = autTotalMarksWeighted + sprTotalMarksWeighted;
                fyrTotalCredits = autTotalCredits + sprTotalCredits;

                autumnAverageByYear.push(calculateAverageGrade(autTotalMarksWeighted, autTotalCredits));
                springAverageByYear.push(calculateAverageGrade(sprTotalMarksWeighted, sprTotalCredits));

                year.average_grade = (calculateAverageGrade(fyrTotalMarksWeighted, fyrTotalCredits));
                year.progressionDecision = getProgressionDecision(studentData[0], modulesStudied, year.academic_year, year.year_stage)
            });

            res.render('studentProgressionStats', {
                title: "My Progression",
                record: studentData[0],
                pathway: studentPathway[0],
                topic: "student",
                years: yearsStudied,
                credits: stageCredits,
                autAverage: autumnAverageByYear,
                sprAverage: springAverageByYear,
                isStudent: true
            });

        } catch (err) {
            console.error('Database error:', err);
            res.sendStatus(500);
        }

    } else {
        res.redirect('/');
    }

});


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
                studentId: studentId,
                isAdmin: false,
                isStudent: true});
        } catch (err) {
            console.error('Database error:', err);
            res.sendStatus(500);
        }
 
    } else {
        res.redirect('/');
    }

});

router.get('/messaging', async (req, res) =>{
    if(req.session.isStudent){

        const announcementsQuery = `SELECT * FROM announcement
                                    JOIN student_announcement ON announcement.announcement_id = student_announcement.announcement_id
                                    WHERE student_announcement.student_id = ?`;
        const messagesQuery = `SELECT * FROM message WHERE student_id = ?`;

        try{
            const [announcements] = await db.promise().query(announcementsQuery, req.session.studentId);
            const [messages] = await db.promise().query(messagesQuery, req.session.studentId);
            res.render('messaging', {announcements: announcements,
                                    messages: messages,
                                    title: "Messaging",
                                    summary: "Messages and Announcements",
                                    isStudent: true
            })
        } catch (err) {
            console.error('Database error:', err);
            res.sendStatus(500);
        }
    } else {
        res.redirect('/');
    }
});

router.post('/messaging', (req, res) => {
    const message = {...req.body}
    res.redirect('/student/messaging')
});

router.post('/profile', async (req, res) => {
    const profileEdit = {...req.body};

    const addSecondaryEmail = `INSERT INTO authentication
                                (secondary_email)
                                VALUES (?)`;

    try{
        await db.promise().query(addSecondaryEmail, profileEdit.secondEmail);
        res.redirect('/student/student-home')
    } catch (err){
        console.error('Database error:', err);
        res.sendStatus(500);
    }
});

module.exports = router;