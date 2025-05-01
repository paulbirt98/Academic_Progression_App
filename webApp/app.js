const express = require('express');
const app = express();
const port = 3000;
const path = require('path');
const {postData, APIURL} = require('./utils/apiHelpers');
const axios = require('axios');

//serving static files
app.use(express.static(path.join(__dirname, './assets'))); 
app.use(express.urlencoded({ extended: true}));

//connect routes to the API
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes//adminRoutes');

app.use('/student', studentRoutes);
app.use('/admin', adminRoutes);

app.set('view engine', 'ejs');

app.get('/', (req, res) =>{
    
        res.render('loginPage', {query: req.query});
    
});

app.post('/', async (req, res) => {

    const loginResponse = await postData(APIURL, req.body, req.headers.cookie);

        if(!loginResponse){
            return res.redirect('/?loginFailure=1');
        }

        if(loginResponse.role === 'admin'){
            req.session.isAdmin = true;
            res.redirect('/admin/admin-home');
        } else if (loginResponse.role ==='student'){
            req.session.studentId = user[0].student_id;
            req.session.isStudent = true;
            res.redirect('/student/student-home')
        } 
});

app.listen(port, () => {
    console.log('Server is running on port 3000');
});