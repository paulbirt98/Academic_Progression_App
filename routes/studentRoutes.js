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

module.exports = router;