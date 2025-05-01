# Academic Progression App
A web applciation for administrators and students to track student progression and grades.


## Getting started

Node.js
npm

git clone https://gitlab.eeecs.qub.ac.uk/40175857/academic-progression-app.git
cd academic-progression-app

npm install
all of the dependencies

import the datbase scheme from the provided file

# Database connection
//database connection
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'academic_progression_app',
    port: '3306'
});

# Once running
GO TO localhost:3000

# Passwords
Admin username is admin@uni.ac.uk
password is 'password'

the first 5 students have login credentials:
firstname.lastname@uni.ac.uk
'password1'
