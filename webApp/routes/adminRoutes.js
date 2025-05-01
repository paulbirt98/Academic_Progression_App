const express = require('express');
const router = express.Router();


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

const calculateRate = (rate, total) => {
    return total > 0 ? (rate / total * 100) : console.log('issue calculating the rate');
};

const getProgressionDecision = (student, modules, academicYear, stage) => {
    const credits = student.attained_credits;

    for (const module of modules) {
        if (module.year_delivered === stage && module.academic_year === academicYear) {
            if (module.core && !module.final_attempt && !module.passed) {
                return "Failed Core Module - repeat the year"
            }

            if (module.final_attempt && !module.passed) {
                return "Failed final attempt - withdraw from the course"
            }
        }
    };

    if (!credits[stage] || credits[stage] < 100) {
        return "Insufficient Credits - repeat the year"
    }

    if (stage === 2 && (!credits[1] || credits[1] < 120)) {
        return "All stage 1 modules must be passed to progress - please contact your advisor of studies"
    }

    return "Progress to the next stage"
};

router.get('/admin-home', (req, res) => {
    if (req.session.isAdmin) {
        res.render('adminHome', {
            title: "Admin Dashboard",
            summary: "Manage students, modules, grades and communications",
            isStudent: false
        }); //for the 'home' link on the navbar
    } else {
        res.redirect('/');
    }
});

router.get('/students', async (req, res) => {
    if (req.session.isAdmin) {
        //the values to be used in the list in the adminManagement ejs
        const studentTemplateQuery = `SELECT 
                                        student.student_id AS idReference,
                                        CONCAT(student.first_name, ' ', student.last_name) AS name,
                                        student.student_id_number AS id_code,
                                        CONCAT(pathway.pathway_name, ' - Stage ', student.stage) AS moreInfo
                                    FROM student
                                    JOIN pathway ON student.pathway_id = pathway.pathway_id
                                    ORDER BY student.last_name, student.first_name`;
        try {
            const [studentTemplateData] = await db.promise().query(studentTemplateQuery);
            res.render('adminManagement', {
                title: "Student Management",
                topic: "Student",
                summary: "Manage student records, view details, and update information.",
                templateData: studentTemplateData,
                isStudent: false
            });
        } catch (err) {
            console.error('Database error:', err);
            res.sendStatus(500);
        }
    } else {
        res.redirect('/');
    }
});

router.get('/students/view/:id', async (req, res) => {

    if (req.session.isAdmin) {
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
                                    ORDER BY module.academic_year, module.module_title;`


        const studentURLId = req.params.id;

        try {
            const [studentData] = await db.promise().query(studentDataQuery, [studentURLId]);
            const [studentPathway] = await db.promise().query(studentPathwayQuery, [studentURLId]);
            //get each year the student has studied and reformat
            const [yearsStudied] = await db.promise().query(yearsStudiedQuery, [studentURLId]);
            const [modulesStudied] = await db.promise().query(modulesStudiedQuery, [studentURLId]);

            res.render('viewStudentRecord', {
                title: "Student Record - " + studentData[0].id_number,
                topic: "student",
                record: studentData[0],
                pathway: studentPathway[0],
                years: yearsStudied,
                modules: modulesStudied,
                studentId: studentURLId,
                isStudent: false,
                isAdmin: true
            });
        } catch (err) {
            console.error('Database error:', err);
            res.sendStatus(500);
        }
    } else {
        res.redirect('/');
    }
});

router.get('/edit-grades/:id', async (req, res) => {
    if (req.session.isAdmin) {
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
                                    ORDER BY module.academic_year, module.module_title;`


        const studentURLId = req.params.id;

        try {
            const [studentData] = await db.promise().query(studentDataQuery, [studentURLId]);
            const [studentPathway] = await db.promise().query(studentPathwayQuery, [studentURLId]);
            const [yearsStudied] = await db.promise().query(yearsStudiedQuery, [studentURLId]);
            const [modulesStudied] = await db.promise().query(modulesStudiedQuery, [studentURLId]);

            res.render('editGrades', {
                title: "Edit student grades - " + studentData[0].id_number,
                topic: "student",
                record: studentData[0],
                pathway: studentPathway[0],
                years: yearsStudied,
                modules: modulesStudied,
                studentId: studentURLId,
                isStudent: false,
                isAdmin: true
            });
        } catch (err) {
            console.error('Database error:', err);
            res.sendStatus(500);
        }
    } else {
        res.redirect('/');
    }
});

router.get('/student-progression', async (req, res) => {
    res.render('studentProgressionSearch');
});

router.get('/student-progression/:id', async (req, res) => {

    if (req.session.isAdmin) {
        const studentURLId = req.params.id;

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
            const [modulesStudied] = await db.promise().query(modulesStudiedQuery, [studentURLId]);
            const [studentData] = await db.promise().query(studentDataQuery, [studentURLId]);
            const [yearsStudied] = await db.promise().query(yearsStudiedQuery, [studentURLId]);
            const [studentPathway] = await db.promise().query(studentPathwayQuery, [studentURLId]);
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
                title: "Student Progression - " + studentData[0].name,
                record: studentData[0],
                pathway: studentPathway[0],
                topic: "student",
                years: yearsStudied,
                credits: stageCredits,
                autAverage: autumnAverageByYear,
                sprAverage: springAverageByYear,
                isStudent: false
            });

        } catch (err) {
            console.error('Database error:', err);
            res.sendStatus(500);
        }

    } else {
        res.redirect('/');
    }

});

router.get('/modules', async (req, res) => {

    if (req.session.isAdmin) {
        //the values to be inputted into the list on'management page' ejs template
        const moduleTemplateQuery = `SELECT
                                        module_id AS idReference,
                                        module_title AS name,
                                        subject_id AS id_code,
                                        CONCAT(semester, ' ', academic_year) AS moreInfo
                                    FROM module;`
        try {
            const [moduleTemplateData] = await db.promise().query(moduleTemplateQuery);
            res.render('adminManagement', {
                title: "Module Management",
                topic: "Module",
                summary: "Manage academic modules and pathways.",
                templateData: moduleTemplateData,
                isStudent: false
            });
        } catch (err) {
            console.error('Database error:', err);
            res.sendStatus(500);
        }
    } else {
        res.redirect('/');
    }
});

router.get('/add-student', async (req, res) => {

    if (req.session.isAdmin) {
        const pathwayOptionsQuery = `SELECT * FROM pathway;`;

        try {
            const [pathwayOptions] = await db.promise().query(pathwayOptionsQuery);
            res.render('addRecord', {
                title: "Add Student Record",
                summary: "Enter student details to add the record to GradeGuru.",
                pathways: pathwayOptions,
                query: req.query,
                isStudent: false
            });
        } catch (err) {
            console.error('Database error:', err);
            res.sendStatus(500);
        }
    } else {
        res.redirect('/');
    }
});

router.post('/add-student', (req, res) => {
    const adminInput = { ...req.body };

    const addStudentRecord = `INSERT INTO student
                                    (first_name, 
                                    last_name,
                                    student_id_number,
                                    pathway_id,
                                    stage)
                                VALUES (?,?,?,?,?)`;
    try {
        db.query(addStudentRecord, [adminInput.firstName, adminInput.lastName, adminInput.studentNo, adminInput.pathway, adminInput.stage]);
        res.redirect('/admin/add-student?success=1');
    } catch (err) {
        console.error('Database error:', err);
        res.sendStatus(500);
    }
    
});

router.get('/add-module', async (req, res) => {

    if (req.session.isAdmin) {
        const existingPathwaysQuery = 'SELECT pathway_id, pathway_name FROM pathway;'
        const existingModulesQuery = 'SELECT DISTINCT semester FROM module;';
        try {
            const [existingModules] = await db.promise().query(existingModulesQuery);
            const [existingPathways] = await db.promise().query(existingPathwaysQuery);
            res.render('addRecord', {
                title: "Add Module Record",
                summary: "Enter module details to add the record to GradeGuru.",
                existingModules: existingModules,
                existingPathways: existingPathways,
                query: req.query,
                isStudent: false
            });
        } catch (err) {
            console.error('Database error:', err);
            res.sendStatus(500);
        }
    } else {
        res.redirect('/');
    }
});

router.post('/add-module', async (req, res) => {
    const adminInput = { ...req.body };

    const addModuleRecord = `INSERT INTO module
                                    (semester, 
                                    subject_id,
                                    module_title,
                                    credit_count,
                                    academic_year)
                                VALUES (?,?,?,?,?)`;

    const addModuleToPathway = `INSERT INTO module_pathway (module_id, pathway_id, year_delivered, core)
                                VALUES (?,?,?,?)`;

    try {
        const [moduleRecord] = await db.promise().query(addModuleRecord, [
            adminInput.semester,
            adminInput.subjectId,
            adminInput.moduleTitle,
            adminInput.credits,
            adminInput.academicYear]);
        const newID = moduleRecord.insertId;

        await db.promise().query(addModuleToPathway, [newID, adminInput.pathway, adminInput.yearDelivered, adminInput.core]);

        res.redirect('/admin/add-module?success=1');
    } catch (err) {
        console.error('Database error:', err);
        res.sendStatus(500);
    }

});

router.get('/modules/view/:id', async (req, res) => {

    if (req.session.isAdmin) {
        const moduleURLId = req.params.id;
        const moduleDataQuery = `SELECT 
                                    subject_id AS id_number,
                                    module_title AS name,
                                    credit_count,
                                    semester,
                                    academic_year
                                FROM module WHERE module_id = ?`;
        const pathwayNameQuery = `SELECT 
                                    pathway.pathway_name,
                                    module_pathway.year_delivered
                                FROM 
                                    module_pathway
                                JOIN 
                                    pathway ON module_pathway.pathway_id = pathway.pathway_id
                                WHERE
                                    module_pathway.module_id= ?`;
        const studentsEnrolledQuery = `SELECT
                                        student.student_id,
                                        student.student_id_number,
                                        CONCAT(student.first_name, ' ',student.last_name) AS name,
                                        student.stage,
                                        student_module.first_grade,
                                        student_module.grade_result,
                                        student_module.resit_grade,
                                        student_module.resit_result
                                    FROM
                                        student
                                    JOIN
                                        student_module ON student.student_id = student_module.student_id
                                    WHERE
                                        student_module.module_id = ?`;
        try {
            const [moduleData] = await db.promise().query(moduleDataQuery, [moduleURLId]);
            const [pathwayName] = await db.promise().query(pathwayNameQuery, [moduleURLId]);
            const [studentsEnrolled] = await db.promise().query(studentsEnrolledQuery, [moduleURLId]);

            let totalEnrolled = studentsEnrolled.length;
            let passes = 0;
            let excused = 0;
            let totalMarks = 0;
            let resits = 0;
            let gradedStudents = 0;

            studentsEnrolled.forEach((student) => {
                const studentGrade = calculateGrade(student);
                if (studentGrade === null) {
                    excused++;
                } else if (studentGrade >= 40) {
                    totalMarks += studentGrade;
                    passes++;
                    gradedStudents++;
                } else if (studentGrade < 40) {
                    totalMarks += studentGrade;
                    gradedStudents++;
                }

                if (student.resit_result) {
                    resits++;
                }
            });
            console.log(gradedStudents);
            const passRate = calculateRate(passes, gradedStudents);
            const resitRate = calculateRate(resits, gradedStudents);
            const averageGrade = calculateAverageGrade(totalMarks, gradedStudents);

            res.render('viewModuleRecord', {
                title: "Module Record - " + moduleData[0].id_number + " - " + moduleURLId,
                topic: "module",
                record: moduleData[0],
                pathway: pathwayName[0],
                students: studentsEnrolled,
                passRate,
                excused,
                totalEnrolled,
                resits,
                resitRate,
                averageGrade,
                isStudent: false
            });
        } catch (err) {
            console.error('Database error:', err);
            res.sendStatus(500);
        }
    } else {
        res.redirect('/');
    }
});

router.get('/grade-upload', async (req, res) => {

    if (req.session.isAdmin) {
        try {
            res.render('gradeUpload', {
                title: "Grade Upload",
                summary: `Upload student grades in bulk from a CSV file. (Please ensure it is in the standardised format)`,
                isStudent: false
            });
        } catch (err) {

        }
    } else if (!req.session.isAdmin) {
        res.render('studentHomepage');
    } else {
        res.redirect('/');
    }
});


router.get('/messaging', async (req, res) => {

    if (req.session.isAdmin) {

        const pathwayOptionsQuery = `SELECT * FROM pathway`;

        try {
            const [pathwayOptions] = await db.promise().query(pathwayOptionsQuery);

            res.render('messaging', {
                isStudent: false,
                title: "Messaging & Announcements",
                summary: "Send an Announcement to a cohort or a Message to an Individual",
                pathways: pathwayOptions,
                query: req.query
            });
        } catch (err) {
            console.error('Database error:', err);
            res.sendStatus(500);
        }

    } else {
        res.redirect('/');
    }

});

router.post('/messaging/announcement', async (req, res) => {
    const announcement = { ...req.body };

    const addAnouncement = `INSERT INTO announcement
                                (announcement_body)
                            VALUES (?)`

    const cohortQuery = ` SELECT student_id FROM student
                         WHERE pathway_id = ? AND stage = ?`

    const addToLinkTable = `INSERT INTO student_announcement
                                (student_id, announcement_id)
                            VALues(?,?)`

    try {
        const [announcementInput] = await db.promise().query(addAnouncement, [announcement.announcement]);
        const announcementId = announcementInput.insertId;

        const [studentCohort] = await db.promise().query(cohortQuery, [announcement.pathway, announcement.stage])

        for (const { student_id } of studentCohort) {
            await db.promise().query(addToLinkTable, [student_id, announcementId])
        };
        
        res.redirect('/admin/messaging?announcementSuccess=1');
    } catch (err) {
        console.error('Database error:', err);
        res.sendStatus(500);
    }


});

router.post('/messaging/message', async (req, res) => {
    const message = { ...req.body };

    const addMessage = `INSERT INTO message
                            (student_id, message_body)
                        VALUES (?,?)`

    const studentQuery = `SELECT student_id FROM student
                        WHERE student_id_number = ?`

    try {
        const [student] = await db.promise().query(studentQuery, message.studentNo);
        const studentId = student[0].student_id;

        await db.promise().query(addMessage, [studentId, message.messageBody]);

        res.redirect('/admin/messaging?messageSuccess=1');
    } catch (err) {
        console.error('Database error:', err);
        res.sendStatus(500);
    }

});

router.post('/admin/modules/delete', async (req, res) => {
    const deleteRequest = { ...req.body };

    const deleteStudentModule = `DELETE FROM student_module WHERE module_id = ?`;
    const deleteModulePathway = `DELETE FROM module_pathway WHERE module_id = ?`;
    const deleteModule = `DELETE FROM module WHERE module_id = ?`;

    try {
        await db.promise().query(deleteStudentModule, deleteRequest.id);
        await db.promise().query(deleteModulePathway, deleteRequest.id);
        await db.promise().query(deleteModule, deleteRequest.id);

        res.redirect('/admin/modules');
    } catch (err) {
        console.error('Database error:', err);
        res.sendStatus(500);
    }
});

router.post('/admin/students/delete', async (req, res) => {
    const deleteRequest = { ...req.body };

    const deleteStudentModule = `DELETE FROM student_module WHERE student_id = ?`;
    const deletestudentAnnouncement = `DELETE FROM student_announcement WHERE student_id = ?`;
    const deleteMessages = `DELETE FROM message WHERE student_id = ?`;
    const deleteAuth = `DELETE FROM authentication WHERE student_id = ?`;
    const deleteStudent = `DELETE FROM student WHERE student_id = ?`;


    try {
        await db.promise().query(deleteStudentModule, deleteRequest.id);
        await db.promise().query(deletestudentAnnouncement, deleteRequest.id);
        await db.promise().query(deleteMessages, deleteRequest.id);
        await db.promise().query(deleteAuth, deleteRequest.id);
        await db.promise().query(deleteStudent, [deleteRequest.id]);

        res.redirect('/admin/modules');
    } catch (err) {
        console.error('Database error:', err);
        res.sendStatus(500);
    }
});

router.post('/admin/edit-grades/:id', async (req, res) => {
    const formData = { ...req.body };
    const studentURLId = req.params.id;
    const moduleCount = parseInt(formData.moduleCount, 10);

    const updateQuery = ` UPDATE student_module 
                            SET first_grade = ?, 
                            grade_result = ?, 
                            resit_grade = ?, 
                            resit_result = ? 
                            WHERE module_id = ? AND student_id = ?`;

    try {
        for (let i = 1; i <= moduleCount; i++) {
            const params = [
                formData[`grade${i}`],
                formData[`graderesult${i}`],
                formData[`resit${i}`],
                formData[`resitresult${i}`],
                formData[`moduleId${i}`],
                studentURLId
            ];

            await db.promise().query(updateQuery, params);
        } 
    } catch (err) {
        console.error('Database error:', err);
        res.sendStatus(500);
    }


        res.redirect(`/admin/students/view/${studentURLId}`);
    });



module.exports = router;