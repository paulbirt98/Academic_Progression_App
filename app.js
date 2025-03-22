const express = require('express');
const app = express();
const port = 3000;
const path = require('path');

//middleware
app.use(express.static(path.join(__dirname, './assets'))); //serving static files

app.set('view engine', 'ejs');

app.get('/admin', (req, res) => {

    res.render('adminHome');

});

app.listen(port, () => {
    console.log('Server is running on port 3000');
});