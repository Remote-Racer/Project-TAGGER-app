//Initial setup
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.set("view engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));


const globalInfo = {
    navEndpoints: [
        '/',
        '/spectate',
        '/player',
        '/test'
    ]
}

//Routing
app.get('/', function(req, res){
    res.render('Home', {
        page: {
            title: 'Home'
        },
        global: globalInfo
    });
});

app.get('/spectate', function(req, res){
    res.render('Spectator');
});

app.get('/player', function(req, res){

    
    res.render('Player', {
        page: {
            title: 'Player'
        },
        global: globalInfo
    });
});

app.get('/test', function(req, res){
    res.render('TestView', {
        page: {
            title: 'Test Page'
        },
        global: globalInfo
    });
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})