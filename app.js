//Initial setup
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.set("view engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

//Routing
app.get('/', function(req, res){
    res.render('Home');
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})