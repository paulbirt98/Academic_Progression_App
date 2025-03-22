const express = require('express');
const app = express();
const port = 3000;

app.set('view engine', 'ejs');

app.get('/admin', (req, res) => {

    res.render('adminHome');

});

app.listen(port, () => {
    console.log('Server is running on port 3000');
});